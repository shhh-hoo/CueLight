import type { CueState } from '../cue/types';

export function CueSurface({ cues }: { cues: CueState }) {
  return (
    <section className="cue-surface" aria-label="Learner surface">
      <div className="previous-slot">
        {cues.previousCue && (
          <article className="previous-cue" data-testid="previous-cue">
            <p className="eyebrow">Just before</p>
            <p>{cues.previousCue.text}</p>
          </article>
        )}
      </div>
      <div className="current-slot" aria-live="polite" aria-atomic="true">
        {cues.currentCue ? (
          <article className="current-cue" key={cues.currentCue.id} data-testid="current-cue" data-cue-id={cues.currentCue.id}>
            <p className="eyebrow"><span className="cue-dot" /> Keep in view</p>
            <p className="cue-text">{cues.currentCue.text}</p>
          </article>
        ) : (
          <div className="empty-cue">
            <span className="empty-mark" aria-hidden="true">✳</span>
            <h1>A little space<br />for the idea.</h1>
            <p>When a teaching point is ready,<br />it will stay here with you.</p>
          </div>
        )}
      </div>
      <div className="surface-footer" aria-hidden="true"><span /> Room to understand.</div>
    </section>
  );
}
