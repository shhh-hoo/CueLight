import type { DecisionScript } from '../decision/mock-decision-provider';
import type { ReplayEntry } from './replay-source';

export type ReplayFixture = Readonly<{
  id: string;
  subject: string;
  title: string;
  description: string;
  entries: readonly ReplayEntry[];
  script: DecisionScript;
}>;

const times = [0, 2_200, 5_800, 8_500, 12_000, 14_500, 16_800];
function entries(id: string, texts: readonly string[]): readonly ReplayEntry[] {
  return texts.map((text, index) => ({
    at: times[index]!,
    fragment: { id: `${id}-${index + 1}`, text, startMs: Math.max(0, times[index]! - 1_500), endMs: times[index]! },
  }));
}

// These explicit decisions are development fixtures, separate from source evidence.
// Nothing about a subject or these scripts is present in the Cue Engine.
const scripts: Record<string, DecisionScript> = {
  science: {
    'science-1': { action: 'QUIET' },
    'science-2': { action: 'NEW_CUE', sourceFragmentIds: ['science-2'] },
    'science-3': { action: 'UPDATE_CURRENT', sourceFragmentIds: ['science-2', 'science-3'] },
    'science-4': { action: 'QUIET' },
    'science-5': { action: 'NEW_CUE', sourceFragmentIds: ['science-5'] },
    'science-6': { action: 'QUIET' },
    'science-7': { action: 'QUIET' },
  },
  history: {
    'history-1': { action: 'QUIET' },
    'history-2': { action: 'NEW_CUE', sourceFragmentIds: ['history-2'] },
    'history-3': { action: 'UPDATE_CURRENT', sourceFragmentIds: ['history-2', 'history-3'] },
    'history-4': { action: 'QUIET' },
    'history-5': { action: 'NEW_CUE', sourceFragmentIds: ['history-5'] },
    'history-6': { action: 'QUIET' },
    'history-7': { action: 'QUIET' },
  },
  literature: {
    'literature-1': { action: 'QUIET' },
    'literature-2': { action: 'NEW_CUE', sourceFragmentIds: ['literature-2'] },
    'literature-3': { action: 'UPDATE_CURRENT', sourceFragmentIds: ['literature-2', 'literature-3'] },
    'literature-4': { action: 'QUIET' },
    'literature-5': { action: 'NEW_CUE', sourceFragmentIds: ['literature-5'] },
    'literature-6': { action: 'QUIET' },
    'literature-7': { action: 'QUIET' },
  },
  programming: {
    'programming-1': { action: 'QUIET' },
    'programming-2': { action: 'NEW_CUE', sourceFragmentIds: ['programming-2'] },
    'programming-3': { action: 'UPDATE_CURRENT', sourceFragmentIds: ['programming-2', 'programming-3'] },
    'programming-4': { action: 'QUIET' },
    'programming-5': { action: 'NEW_CUE', sourceFragmentIds: ['programming-5'] },
    'programming-6': { action: 'QUIET' },
    'programming-7': { action: 'QUIET' },
  },
  mathematics: {
    'mathematics-1': { action: 'QUIET' },
    'mathematics-2': { action: 'NEW_CUE', sourceFragmentIds: ['mathematics-2'] },
    'mathematics-3': { action: 'UPDATE_CURRENT', sourceFragmentIds: ['mathematics-2', 'mathematics-3'] },
    'mathematics-4': { action: 'QUIET' },
    'mathematics-5': { action: 'NEW_CUE', sourceFragmentIds: ['mathematics-5'] },
    'mathematics-6': { action: 'QUIET' },
    'mathematics-7': { action: 'QUIET' },
  },
};

export const replayFixtures: readonly ReplayFixture[] = [
  {
    id: 'science', subject: 'Science', title: 'Water on the move',
    description: 'Osmosis, a clarification, and a new idea.',
    entries: entries('science', [
      'All right, take a moment to look at the diagram.',
      'Osmosis is the movement of water across a partially permeable membrane.',
      'The moving particles are water, not solute.',
      'Give yourself a moment to think about that.',
      'Diffusion is the net movement of particles from higher to lower concentration.',
      'We will look at an example together in a moment.',
      'Okay, let us pause there.',
    ]), script: scripts.science!,
  },
  {
    id: 'history', subject: 'History', title: 'After the armistice',
    description: 'A date, its context, and a different institution.',
    entries: entries('history', [
      'Let us get settled and look at the timeline.',
      'The Treaty of Versailles was signed in 1919.',
      'That was after the armistice of November 1918.',
      'Take a moment with those dates.',
      'The League of Nations was established in 1920.',
      'We will discuss the next question shortly.',
      'Keep that in mind for now.',
    ]), script: scripts.history!,
  },
  {
    id: 'literature', subject: 'Literature', title: 'What the audience knows',
    description: 'Dramatic irony, its effect, and a new technique.',
    entries: entries('literature', [
      'Find the passage on your page, and take your time.',
      'Shakespeare uses dramatic irony because the audience knows what Romeo does not.',
      'That gap in knowledge makes his actions more painful to watch.',
      'Let us sit with that for a moment.',
      'A soliloquy lets a character speak their thoughts aloud while alone on stage.',
      'We will come back to the passage shortly.',
      'There is no need to rush.',
    ]), script: scripts.literature!,
  },
  {
    id: 'programming', subject: 'Programming', title: 'Change, or create again?',
    description: 'List mutability, what it means, and tuples.',
    entries: entries('programming', [
      'Open the example and make sure you can see it.',
      'A Python list is mutable.',
      'That means you can change its elements after creating it.',
      'Take a second to look at the example.',
      'A Python tuple is immutable: you cannot replace its elements after creation.',
      'We can try this out together in a moment.',
      'Okay, pause here.',
    ]), script: scripts.programming!,
  },
  {
    id: 'mathematics', subject: 'Mathematics', title: 'Keep both sides balanced',
    description: 'An equation, an equivalent form, and a new rule.',
    entries: entries('mathematics', [
      'Have your paper ready and look at the board.',
      'x squared plus 2x equals 3.',
      'Subtracting 3 from both sides gives x squared plus 2x minus 3 equals zero.',
      'Check that you have written that down.',
      'If a product of two factors is zero, at least one factor must be zero.',
      'We will work through an example next.',
      'Take a moment before we continue.',
    ]), script: scripts.mathematics!,
  },
];
