import { freeze, requireDomain as check } from './evidence';
import { emptyLesson, prepareAcceptance, reduceAccepted, resultVersions } from './reducer';
import type { AcceptedEvent, LessonHistory, LessonState, SemanticProposal } from './types';

export function replayLesson(history: LessonHistory): LessonState {
  check(history.format === 'alive-cue-v1' && Array.isArray(history.events), 'Unsupported lesson history.');
  let state = emptyLesson(history.sessionId, history.sessionEpoch);
  const proposals = new Set<string>();
  for (const event of history.events) {
    check(!proposals.has(event.proposalId), 'Duplicate proposal in accepted history.'); proposals.add(event.proposalId);
    state = reduceAccepted(state, event);
    check(JSON.stringify(resultVersions(state)) === JSON.stringify(event.resultingVersions), 'Invalid replay version results.');
  }
  return state;
}

// This slice has one synchronous local writer. append must durably write the
// whole event or throw. No await/user callback may divide its check and write.
export interface LessonJournal {
  read(): LessonHistory;
  append(event: AcceptedEvent, expectedSequence: number): void;
  delete(): void;
}
export function memoryJournal(sessionId: string, sessionEpoch = 0): LessonJournal {
  let history: LessonHistory = freeze({ format: 'alive-cue-v1', sessionId, sessionEpoch, events: [] });
  let deleted = false;
  return {
    read: () => { check(!deleted, 'Lesson deleted.'); return history; },
    append(event, expectedSequence) {
      check(!deleted && history.events.length === expectedSequence, 'Journal changed or was deleted.');
      history = freeze({ ...history, events: [...history.events, structuredClone(event)] });
    },
    delete() { deleted = true; },
  };
}

// sessionStorage is intentionally tab-scoped: reloadable text history without
// pretending localStorage read/check/write is a cross-tab database transaction.
// Callers can export the portable history before closing the tab.
export function browserJournal(sessionId: string, sessionEpoch = 0, storage: Storage = sessionStorage): LessonJournal {
  const key = `cuelight:alive:${sessionId}:${sessionEpoch}`;
  const empty: LessonHistory = { format: 'alive-cue-v1', sessionId, sessionEpoch, events: [] };
  let deleted = false;
  return {
    read() {
      check(!deleted, 'Lesson deleted.');
      const raw = storage.getItem(key);
      const history: LessonHistory = raw ? JSON.parse(raw) : empty;
      check(history.sessionId === sessionId && history.sessionEpoch === sessionEpoch, 'Wrong stored lesson.');
      return history;
    },
    append(event, expectedSequence) {
      const history = this.read();
      check(history.events.length === expectedSequence, 'Journal changed; reload before accepting.');
      storage.setItem(key, JSON.stringify({ ...history, events: [...history.events, event] }));
    },
    delete() { storage.removeItem(key); deleted = true; },
  };
}

// Object key insertion order is not semantic; array order is (parts/operations).
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
}
function proposalPayload(event: AcceptedEvent): SemanticProposal {
  const { eventId: _id, eventSequence: _sequence, acceptedAt: _at, createdCueIds: _created,
    resultingVersions: _versions, ...proposal } = event;
  return proposal;
}

export class LessonStore {
  private state: LessonState;
  private history: LessonHistory;
  private accepting = false;
  private deleted = false;
  constructor(private readonly journal: LessonJournal) {
    this.history = freeze(structuredClone(journal.read()));
    this.state = replayLesson(this.history);
  }
  getSnapshot = (): LessonState => this.state;
  export = (): LessonHistory => this.history;
  accept(proposal: SemanticProposal, acceptedAt: number): AcceptedEvent {
    check(!this.deleted && !this.accepting, 'Lesson unavailable or acceptance already in progress.');
    check(proposal.sessionId === this.state.sessionId && proposal.sessionEpoch === this.state.sessionEpoch, 'Wrong session or epoch.');
    const previous = this.history.events.find(e => e.proposalId === proposal.proposalId);
    if (previous) {
      check(canonical(proposalPayload(previous)) === canonical(proposal), 'Proposal identity reuse with different payload.');
      return previous;
    }
    this.accepting = true;
    try {
      const candidate = prepareAcceptance(this.state, proposal, acceptedAt);
      try { this.journal.append(candidate.event, this.state.sequence); }
      catch (error) {
        // A durable write with a lost acknowledgement is recoverable by identity.
        const recovered = this.journal.read();
        const accepted = recovered.events.find(e => e.proposalId === proposal.proposalId);
        if (!accepted || JSON.stringify(accepted) !== JSON.stringify(candidate.event)) throw error;
        const replayed = replayLesson(recovered);
        this.history = freeze(structuredClone(recovered)); this.state = replayed;
        return accepted;
      }
      this.history = freeze({ ...this.history, events: [...this.history.events, candidate.event] });
      this.state = candidate.state;
      return candidate.event;
    } finally { this.accepting = false; }
  }
  delete(): void {
    check(!this.accepting, 'Acceptance already in progress.');
    this.journal.delete(); this.deleted = true;
    this.state = emptyLesson(this.state.sessionId, this.state.sessionEpoch + 1);
    this.history = freeze({ ...this.history, sessionEpoch: this.state.sessionEpoch, events: [] });
  }
}
