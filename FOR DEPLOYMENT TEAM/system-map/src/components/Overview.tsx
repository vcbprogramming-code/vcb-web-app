/** L0 progressive-disclosure overview: stage cards + supporting-function cards
 *  with an audience-mode toggle (Orientation / AI Opportunity / Management).
 *  Mirrors renderOverview()/openStage()/setAudience()/aiCountForLanes() and the
 *  `.ov-layer`/`.l1-crumb` markup in Index.html.
 *
 *  NOTE (behaviour parity, not a deviation): in the canonical app this layer is
 *  built at load (renderOverview(); setAudience('orient');) but starts, and
 *  always stays, hidden (`ov-hidden` in the markup) — no button in the shipped
 *  header/banner ever calls showOverview()/backToOverview() to reveal it. This
 *  component and the store wiring are fully functional; store.tsx defaults
 *  `overviewOpen` to false to match what actually renders on load.
 */
import { STAGES, SUPPORT, LANES, AI_OPPS } from '../data';
import type { Stage, SupportItem } from '../data/types';
import type { Store } from '../store';

function aiCountForLanes(laneIds: string[]): number {
  let c = 0;
  LANES.forEach((l) => {
    if (laneIds.includes(l.id)) l.nodes.forEach((n) => { if (AI_OPPS[n.id]) c++; });
  });
  return c;
}

function allStages(): (Stage | SupportItem)[] {
  return [...STAGES, ...SUPPORT];
}

export default function Overview({ s }: { s: Store }) {
  return (
    <div className={'ov-layer' + (s.overviewOpen ? '' : ' ov-hidden')} id="ovLayer">
      <div className="ov-head">
        <div className="ov-title">
          VCB — How the Work Flows <span>click a stage to dive into its functions</span>
        </div>
        <div className="ov-modes">
          <button className={'ov-mode' + (s.audience === 'orient' ? ' active' : '')} onClick={() => s.setAudience('orient')}>
            🧭 Orientation
          </button>
          <button className={'ov-mode' + (s.audience === 'ai' ? ' active' : '')} onClick={() => s.setAudience('ai')}>
            🤖 AI Opportunity
          </button>
          <button className={'ov-mode' + (s.audience === 'mgmt' ? ' active' : '')} onClick={() => s.setAudience('mgmt')}>
            📊 Management
          </button>
        </div>
      </div>
      <div className="ov-flow">
        <span className="ov-flow-chip ov-flow-out">💸 Money out — Buy · Subcontract · Petty → AP (ตั้งหนี้) → Pay → GL</span>
        <span className="ov-flow-chip ov-flow-in">💰 Money in — Progress → Bill (AR) → Collect → Cash</span>
      </div>
      <div className="ov-stages" id="ovStages">
        {STAGES.map((stg) => (
          <div className="ov-stage" id={stg.id} key={stg.id} onClick={() => s.openStage(stg.id)}>
            <div className="ov-stage-num">STAGE {stg.n}</div>
            <div className="ov-stage-ic">{stg.icon}</div>
            <div className="ov-stage-t">{stg.t}</div>
            <div className="ov-stage-mods">
              {stg.mods.map((m) => (
                <span className="ov-mod" key={m}>
                  {m}
                </span>
              ))}
            </div>
            <div className="ov-stage-d">{stg.d}</div>
            <div className="ov-stage-ai" style={{ display: s.audience === 'ai' ? 'block' : undefined }}>
              🤖 {aiCountForLanes(stg.lanes)} AI opportunities
            </div>
            <div className="ov-stage-go">Open functions ▸</div>
          </div>
        ))}
      </div>
      <div className="ov-band-title">SUPPORTING FUNCTIONS</div>
      <div className="ov-support" id="ovSupport">
        {SUPPORT.map((sp) => (
          <div className="ov-sup" id={sp.id} key={sp.id} onClick={() => s.openStage(sp.id)}>
            <div className="ov-sup-t">
              {sp.icon} {sp.t}{' '}
              {sp.mods.map((m) => (
                <span className="ov-mod" key={m}>
                  {m}
                </span>
              ))}
            </div>
            <div className="ov-sup-d">{sp.d}</div>
          </div>
        ))}
      </div>
      <div className="ov-hint">
        Layer 1 — streamlined stages · click a stage → Layer 2 — detailed functions · click a function → its steps,
        Mango module &amp; AI opportunity
      </div>
    </div>
  );
}

/** L1 breadcrumb bar shown above the swimlane map once a stage is opened
 *  (mirrors #l1Crumb — dims all lanes not in the chosen stage). */
export function StageCrumb({ s }: { s: Store }) {
  if (!s.focusedStageId) return null;
  const stg = allStages().find((x) => x.id === s.focusedStageId);
  if (!stg) return null;
  return (
    <div className="l1-crumb" id="l1Crumb">
      <span className="l1-crumb-stage" id="l1CrumbStage">
        {stg.icon ? stg.icon + ' ' : ''}
        {stg.t}
      </span>
      <span className="l1-crumb-mods" id="l1CrumbMods">
        {stg.mods.length ? 'Modules: ' + stg.mods.join(' · ') : ''}
      </span>
      <button style={{ marginLeft: 'auto' }} onClick={s.clearFocusStage}>
        ✕ Show full map
      </button>
    </div>
  );
}

export { allStages };
