export type Cue = Readonly<{
  id: string;
  text: string;
  sourceFragmentIds: readonly string[];
  createdAt: number;
  updatedAt: number;
}>;

export type CueState = Readonly<{
  currentCue: Cue | null;
  previousCue: Cue | null;
}>;

export function emptyCueState(): CueState {
  return Object.freeze({ currentCue: null, previousCue: null });
}
