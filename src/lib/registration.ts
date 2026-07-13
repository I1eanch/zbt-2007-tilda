export interface RegistrationPayload {
  name: string;
  email: string;
  messenger: string;
}

export type RegistrationResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' };

export function submitRegistration(
  _payload: RegistrationPayload,
): RegistrationResult {
  return { ok: false, reason: 'not-configured' };
}
