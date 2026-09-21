export type SemanticFailureKind = 'timeout' | 'transport' | 'http' | 'invalid_choice' | 'malformed_response' | 'cancelled';
export class SemanticProviderError extends Error {
  constructor(readonly kind: SemanticFailureKind, message: string, readonly requestModel?: string) { super(message); }
}
