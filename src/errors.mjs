export class DomainError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
export const inputError = (message) => new DomainError(422, 'invalid_input', message);
export const forbidden = (message) => new DomainError(403, 'forbidden', message);
export const conflict = (message) => new DomainError(409, 'invalid_state', message);
export const missing = (message) => new DomainError(404, 'not_found', message);
