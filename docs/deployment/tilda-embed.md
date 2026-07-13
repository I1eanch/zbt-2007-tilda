# Встраивание в Tilda через iframe (блок T123)

Как показать этот лендинг внутри страницы Tilda: сайт хостится отдельно (тот же
контейнер Docker/nginx, что и в основном runbook), а в Tilda добавляется блок
**T123 «HTML-код»** с `<iframe>`, указывающим на маршрут `/embed/`.

Основной сайт (`/`) остаётся отдельной, самостоятельной страницей и **не**
встраивается: он по-прежнему защищён `X-Frame-Options: DENY`. Встраиваемый —
только `/embed/`.

## Как это устроено

- **Отдельный маршрут `/embed/`** (`src/pages/embed.astro`) рендерит те же 11
  секций, что и `/`, но без фиксированного site-chrome (`Header`, `StickyCTA`):
  в iframe с авто-высотой `position: fixed` не может залипать, поэтому шапка и
  плавающая кнопка убраны. Секционные CTA «Забрать место» работают —
  открывают модалку регистрации.
- **Авто-высота (auto-resize).** Внутри iframe нет собственного скролла:
  страница прокручивается родительской страницей Tilda. Встроенный мост
  (`src/lib/embed.ts`) публикует фактическую высоту документа наверх через
  `postMessage`, а скрипт из блока T123 подгоняет высоту iframe. Так нет
  вложенного скролла.
- **Модалка регистрации.** При открытии модалки мост шлёт наверх сообщение, и
  скрипт T123 временно переводит iframe в `position: fixed` на весь экран
  (`100vh`). Тогда `position: fixed` модалки центрируется в реальном видимом
  окне, а не в середине многоэкранного документа. На это время скролл
  родительской страницы блокируется. При закрытии iframe возвращается в поток с
  авто-высотой.
- **Анимации.** Scroll-триггеры (GSAP/ScrollTrigger) в авто-высотном iframe не
  срабатывают предсказуемо (нет внутреннего скролла), поэтому в embed-режиме
  контент показывается статично, полностью видимым, без reveal-анимаций и
  count-up (счётчики сразу показывают итоговые значения).

## Требование: разрешить фрейминг с домена Tilda

Браузер загрузит `/embed/` во фрейме только если родительский origin (домен
опубликованной страницы Tilda) разрешён в `Content-Security-Policy:
frame-ancestors`. Значение задаётся переменной окружения `FRAME_ANCESTORS`
(подставляется в `nginx.conf.template` при старте контейнера).

Значение по умолчанию (в `Dockerfile`) разрешает домены платформы Tilda:

```
'self' https://*.tilda.ws https://*.tilda.cc https://*.tilda.ru https://tilda.ws https://tilda.cc https://tilda.ru
```

- Если страница Tilda опубликована на **поддомене Tilda** (`*.tilda.ws`) —
  значения по умолчанию достаточно.
- Если страница опубликована на **собственном домене** — оператор **обязан**
  добавить этот origin. В Dokploy (или `docker run`) задайте переменную
  окружения, например:

**Dokploy** (Environment): ключ `FRAME_ANCESTORS`, значение (одной строкой):

```
'self' https://*.tilda.ws https://*.tilda.cc https://*.tilda.ru https://tilda.ws https://tilda.cc https://tilda.ru https://tilda.example.com
```

**`docker run` / Compose** — значение целиком в кавычках (пробелы внутри):

```bash
docker run -e FRAME_ANCESTORS="'self' https://tilda.example.com" ...
```

> `FRAME_ANCESTORS` — операторский вход. Указывайте реальный опубликованный
> домен Tilda; поддомены платформы можно оставить, если также используются.

Проверить, что фрейминг разрешён (после деплоя):

```bash
curl -sI "https://<ваш-домен-сайта>/embed/" | grep -i content-security-policy
# ожидается: content-security-policy: frame-ancestors 'self' https://... (без литерала ${FRAME_ANCESTORS})
```

## Код для блока T123

В редакторе Tilda добавьте блок **T123 (HTML-код)** обычным блоком в потоке
страницы (не внутри Zero Block / артборда с CSS-трансформациями — иначе
`position: fixed` фрейма при открытии модалки будет считаться относительно
трансформированного предка). Вставьте код ниже и замените `SITE_URL` на адрес,
где размещён сайт (со схемой, без завершающего слэша), например
`https://landing.example.com`.

```html
<div id="zbt-embed">
  <iframe
    id="zbt-embed-frame"
    src="SITE_URL/embed/"
    title="Марафон «Здоровье без таблеток»"
    style="display:block;width:100%;border:0;min-height:100vh"
    scrolling="no"
    allow="clipboard-write"
  ></iframe>
</div>
<style>
  #zbt-embed-frame.zbt-embed-fixed {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100vh !important;
    z-index: 100000;
  }
  body.zbt-embed-modal-open {
    overflow: hidden;
  }
</style>
<script>
  (function () {
    var frame = document.getElementById('zbt-embed-frame');
    if (!frame) return;
    var wrap = document.getElementById('zbt-embed');
    var origin = new URL(frame.getAttribute('src'), window.location.href).origin;

    function restore() {
      frame.classList.remove('zbt-embed-fixed');
      document.body.classList.remove('zbt-embed-modal-open');
      // Возвращаем обёртку в поток (высота снова задаётся высотой iframe).
      wrap.style.height = '';
    }

    window.addEventListener('message', function (event) {
      // Доверяем только сообщениям именно из нашего iframe и с его origin.
      if (event.source !== frame.contentWindow) return;
      if (event.origin !== origin) return;
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'zbt-embed') return;
      if (data.version !== 1) return;

      if (data.type === 'zbt-embed:height' && typeof data.value === 'number' && isFinite(data.value) && data.value > 0) {
        // Пока открыта модалка (fixed-fullscreen) высоту не трогаем.
        if (!frame.classList.contains('zbt-embed-fixed')) {
          frame.style.height = data.value + 'px';
        }
      } else if (data.type === 'zbt-embed:modal') {
        if (data.open) {
          // Фиксируем текущую высоту обёртки ДО того как iframe покинет поток,
          // иначе блок схлопнется и страница Tilda прыгнет по скроллу
          // (особенно если CTA нажали внизу лендинга).
          wrap.style.height = frame.getBoundingClientRect().height + 'px';
          frame.classList.add('zbt-embed-fixed');
          document.body.classList.add('zbt-embed-modal-open');
        } else {
          restore();
        }
      }
    });

    // Подстраховка: если iframe перезагрузится или пропадёт, снимаем блокировки.
    frame.addEventListener('load', restore);
    window.addEventListener('pagehide', restore);
  })();
</script>
```

### Что делает скрипт

- Слушает `postMessage` **только** от `iframe.contentWindow` и **только** с
  origin нашего сайта; игнорирует любые чужие сообщения (Tilda и её виджеты тоже
  шлют `postMessage`). Проверяет версионированную схему (`data.source ===
  'zbt-embed'`).
- `zbt-embed:height` → задаёт высоту iframe (auto-resize).
- `zbt-embed:modal { open }` → на открытие переводит iframe в fixed-fullscreen и
  блокирует скролл страницы Tilda; на закрытие — возвращает всё назад.
- На `load`/`pagehide` снимает fixed/блокировку скролла, чтобы страница не
  «залипла» при перезагрузке фрейма.

## Проверка после публикации

1. Открыть опубликованную страницу Tilda — лендинг виден целиком, без
   внутренней полосы прокрутки, высота подгоняется под контент.
2. Прокрутить до конца — низ футера не обрезан (высота обновилась).
3. Нажать любую кнопку «Забрать место» — модалка открывается по центру
   видимого экрана, фон затемнён, страница Tilda под ней не прокручивается.
4. Закрыть модалку (крестик / Esc / клик по фону) — фрейм возвращается в поток,
   позиция прокрутки страницы сохранена.
5. В DevTools → Network проверить, что `/embed/` загрузился со статусом 200 и
   без ошибки о `frame-ancestors` в консоли.
