export type CueDecision =
  | { action: 'QUIET' }
  | { action: 'NEW_CUE'; candidateId: string }
  | { action: 'UPDATE_CURRENT'; candidateId: string };

export const QUIET: CueDecision = Object.freeze({ action: 'QUIET' });
