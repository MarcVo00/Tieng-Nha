export class DomainError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = new.target.name;
  }
}
export class InvalidInviteError extends DomainError { constructor() { super("invalid_invite"); } }
export class PseudoTakenError extends DomainError { constructor() { super("pseudo_taken"); } }
export class InvalidProfileError extends DomainError { constructor() { super("invalid_profile"); } }
export class ExamLimitError extends DomainError { constructor() { super("exam_limit"); } }
export class OfflineError extends DomainError { constructor() { super("offline"); } }
export class InvalidCredentialsError extends DomainError { constructor() { super("invalid_credentials"); } }
export class WeakPasswordError extends DomainError { constructor() { super("weak_password"); } }
export class SamePasswordError extends DomainError { constructor() { super("same_password"); } }
export class NotAuthenticatedError extends DomainError { constructor() { super("not_authenticated"); } }
export class ContentNotFoundError extends DomainError {
  constructor(public readonly refId: string) { super("content_not_found", `Content not found: ${refId}`); }
}
