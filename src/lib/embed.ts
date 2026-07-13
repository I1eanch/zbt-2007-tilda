// Мост между встроенной в Tilda (iframe, блок T123) страницей `/embed` и
// родительской страницей. Публикует наверх два сообщения:
//   { type: 'zbt-embed:height', value }  — фактическая высота документа, чтобы
//     родительский скрипт подгонял высоту iframe (auto-resize, без внутреннего
//     скролла: страница прокручивается родителем).
//   { type: 'zbt-embed:modal', open }    — открытие/закрытие модалки регистрации;
//     родитель на время открытия делает iframe fixed-fullscreen, чтобы
//     `position: fixed` модалки центрировался во весь видимый viewport.
//
// Сообщения — версионированные объекты; родитель дополнительно проверяет
// event.source и event.origin. Мост активен только на `/embed`
// (data-embed="true" на <html>).

const MESSAGE_VERSION = 1;

type EmbedPayload =
  | { type: 'zbt-embed:height'; value: number }
  | { type: 'zbt-embed:modal'; open: boolean };

export function initEmbedBridge(): () => void {
  if (document.documentElement.dataset.embed !== 'true') return () => undefined;

  const post = (payload: EmbedPayload) => {
    window.parent.postMessage(
      { source: 'zbt-embed', version: MESSAGE_VERSION, ...payload },
      '*',
    );
  };

  // --- Auto-resize -----------------------------------------------------------
  let lastHeight = -1;
  const postHeight = () => {
    const height = Math.ceil(document.documentElement.scrollHeight);
    if (height === lastHeight) return;
    lastHeight = height;
    post({ type: 'zbt-embed:height', value: height });
  };

  let frame = 0;
  const scheduleHeight = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      postHeight();
    });
  };

  const resizeObserver = new ResizeObserver(scheduleHeight);
  // Observe both: documentElement catches viewport-driven reflow, body catches
  // late content growth (font swap, lazily-mounted registration widget) that may
  // change scrollHeight without changing the documentElement box.
  resizeObserver.observe(document.documentElement);
  resizeObserver.observe(document.body);
  window.addEventListener('resize', scheduleHeight);
  window.addEventListener('load', scheduleHeight);
  scheduleHeight();

  // --- Modal open/close ------------------------------------------------------
  const modal = document.querySelector<HTMLElement>('[data-registration-modal]');
  let modalObserver: MutationObserver | null = null;
  if (modal) {
    let lastOpen: boolean | null = null;
    const syncModal = () => {
      const open = modal.dataset.open === 'true';
      if (open === lastOpen) return;
      lastOpen = open;
      post({ type: 'zbt-embed:modal', open });
    };
    modalObserver = new MutationObserver(syncModal);
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['data-open'] });
    syncModal();
  }

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener('resize', scheduleHeight);
    window.removeEventListener('load', scheduleHeight);
    if (modalObserver) modalObserver.disconnect();
  };
}
