import type { LessonHistory, LessonState } from '../alive/types';
import type { PresentationResult } from '../refinement/presentation';

export type TeacherNote = Readonly<{ text: string; mismatch: boolean }>;
export type RecordStatus = Readonly<{
  source: 'demo' | 'text-replay' | 'microphone' | 'unknown';
  phase: 'ready' | 'capturing' | 'paused' | 'stopping' | 'stopped' | 'finished' | 'interrupted' | 'unknown';
  issues: readonly { kind: 'capture' | 'processing'; message: string; observedAtSequence: number }[];
}>;
export type SavedPresentation = Readonly<{ cueId: string; revision: number; result: PresentationResult }>;
export type TraceArchive = Readonly<{
  format: 'cuelight-trace'; version: 1; history: LessonHistory;
  workspace: { notes: Readonly<Record<string, TeacherNote>>; record: RecordStatus; presentations: readonly SavedPresentation[] };
}>;
export type OpenedTrace = { archive: TraceArchive; lesson: LessonState };
export type LeaveGuard = { current: () => boolean };
export const unknownRecord: RecordStatus = { source: 'unknown', phase: 'unknown', issues: [] };
