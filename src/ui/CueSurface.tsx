import type { CueState } from '../cue/types';
import type { PresentationResult } from '../refinement/presentation';
import type { DisplayState } from '../refinement/types';

// These relationship words are host-owned: the model supplies content, never markup.
const relationships = {
  sequence: { text: 'then', symbol: '· · ·' },
  causes: { text: 'causes', symbol: '⇒' },
  becomes: { text: 'becomes', symbol: '↦' },
  moves_to: { text: 'moves to', symbol: '→' },
} as const;

function CueContent({ sourceText, presentation }: { sourceText: string; presentation?: PresentationResult }) {
  if (!presentation || presentation.kind === 'source') return <p className="cue-text">{sourceText}</p>;
  return <div className="cue-presentation" data-presentation-kind="presentation">
    {presentation.blocks.map((block, index) => {
      if (block.kind === 'text') return <p className="cue-text" key={index}>{block.text}</p>;
      if (block.kind === 'list') return <ul className="cue-list" key={index}>
        {block.items.map((item, itemIndex) => <li key={itemIndex}>
          {item.label !== null && <strong className="cue-item-label">{item.label}: </strong>}
          <span>{item.text}</span>
        </li>)}
      </ul>;
      return <ol className="cue-chain" role="list" aria-label="Connected ideas" key={index}>
        {block.nodes.map((node, nodeIndex) => {
          const link = block.links[nodeIndex];
          return <li key={nodeIndex}>
            <span className="cue-chain-node">{node}</span>
            {link && <span className={`cue-chain-link cue-chain-link-${link.kind}`} data-link-kind={link.kind}>
              <span className="cue-chain-symbol" aria-hidden="true">{relationships[link.kind].symbol}</span>
              <span className="cue-chain-relationship">{relationships[link.kind].text}</span>
              {link.label !== null && <span className="cue-chain-label">{link.label}</span>}
            </span>}
          </li>;
        })}
      </ol>;
    })}
  </div>;
}

export function CueSurface({ cues, display }: { cues: CueState; display?: DisplayState }) {
  const content = (slot: 'currentCue' | 'previousCue') => {
    const source = cues[slot];
    const shown = display?.[slot];
    if (!source) return null;
    const presentation = shown && source.id === shown.id && source.sourceRevision === shown.sourceRevision
      ? shown.presentation : undefined;
    return <CueContent sourceText={source.text} presentation={presentation} />;
  };
  return (
    <section className="cue-surface" aria-label="Learner surface">
      <div className="previous-slot">
        {cues.previousCue && (
          <article className="previous-cue" data-testid="previous-cue">
            <p className="eyebrow">Just before</p>
            {content('previousCue')}
          </article>
        )}
      </div>
      <div className="current-slot" aria-live="polite" aria-atomic="true">
        {cues.currentCue ? (
          <article className="current-cue" key={cues.currentCue.id} data-testid="current-cue" data-cue-id={cues.currentCue.id}>
            <p className="eyebrow"><span className="cue-dot" /> Keep in view</p>
            {content('currentCue')}
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
