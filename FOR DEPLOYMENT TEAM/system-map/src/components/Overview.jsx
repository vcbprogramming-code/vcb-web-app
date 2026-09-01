/** L0 progressive-disclosure overview: stage cards + supporting-function cards
 *  with an audience-mode toggle (Orientation / AI Opportunity / Management).
 *
 *  NOTE (behaviour parity, not a deviation): in the canonical app this layer is
 *  built at load but starts, and always stays, hidden — no button in the shipped
 *  header ever calls showOverview()/backToOverview() to reveal it. The component
 *  and its store wiring are fully functional; store.jsx defaults `overviewOpen`
 *  to false to match what actually renders on load.
 */
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { STAGES, SUPPORT, LANES, AI_OPPS } from '../data/index.js';

function aiCountForLanes(laneIds) {
  let c = 0;
  LANES.forEach((l) => {
    if (laneIds.includes(l.id)) {
      l.nodes.forEach((n) => {
        if (AI_OPPS[n.id]) c++;
      });
    }
  });
  return c;
}

export function allStages() {
  return [...STAGES, ...SUPPORT];
}

/** The module-code chip repeated on every stage and support card. */
function ModChip({ children }) {
  return (
    <span className="ov-mod rounded-[5px] bg-map-head px-1.5 py-0.5 text-3xs font-extrabold tracking-[.04em] text-sky-300">
      {children}
    </span>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      className={
        'cursor-pointer rounded-md border-[1.5px] px-3 py-1.5 text-base2 font-bold transition-all duration-150 ' +
        (active
          ? 'border-flow bg-flow text-slate-900'
          : 'border-map-rail bg-transparent text-slate-400 hover:border-map-rail2 hover:text-slate-200')
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Overview() {
  const s = useStore();
  const { t } = useI18n();

  return (
    <div
      className={
        'fixed inset-x-0 bottom-0 top-[var(--header-h)] z-[60] flex-col gap-[18px] overflow-auto bg-map-bg px-[30px] pb-[70px] pt-6 ' +
        (s.overviewOpen ? 'flex' : 'hidden')
      }
      id="ovLayer"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-xl font-extrabold text-slate-200">
          {t('ov.title')}{' '}
          <span className="ml-2.5 text-body2 font-normal text-slate-500">{t('ov.subtitle')}</span>
        </div>
        <div className="ml-auto flex gap-1.5">
          <ModeBtn active={s.audience === 'orient'} onClick={() => s.setAudience('orient')}>
            {t('ov.orientation')}
          </ModeBtn>
          <ModeBtn active={s.audience === 'ai'} onClick={() => s.setAudience('ai')}>
            {t('ov.aiOpportunity')}
          </ModeBtn>
          <ModeBtn active={s.audience === 'mgmt'} onClick={() => s.setAudience('mgmt')}>
            {t('ov.management')}
          </ModeBtn>
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5">
        <span className="ov-flow-chip rounded-pill border border-rose-400 bg-rose-500/[.12] px-[13px] py-1.5 text-base2 font-bold text-rose-400">
          {t('ov.moneyOut')}
        </span>
        <span className="ov-flow-chip rounded-pill border border-emerald-400 bg-emerald-400/[.12] px-[13px] py-1.5 text-base2 font-bold text-emerald-400">
          {t('ov.moneyIn')}
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-3.5" id="ovStages">
        {STAGES.map((stg) => (
          <div
            className="relative flex min-w-[185px] flex-1 cursor-pointer flex-col gap-[9px] rounded-[14px] border-[1.5px] border-map-head bg-map-card2 p-4 transition-all duration-200 hover:-translate-y-[3px] hover:border-flow hover:shadow-stage"
            id={stg.id}
            key={stg.id}
            onClick={() => s.openStage(stg.id)}
          >
            <div className="absolute right-[15px] top-[13px] text-4xs font-extrabold tracking-[.05em] text-slate-600">
              {t('ov.stage', { n: stg.n })}
            </div>
            <div className="text-[27px]">{stg.icon}</div>
            <div className="text-[15px] font-extrabold text-slate-100">{stg.t}</div>
            <div className="flex flex-wrap gap-1">
              {stg.mods.map((m) => (
                <ModChip key={m}>{m}</ModChip>
              ))}
            </div>
            <div className="flex-1 text-cap leading-[1.5] text-slate-400">{stg.d}</div>
            {/* .ov-stage-ai is revealed by body.aud-ai (index.css). */}
            <div className="ov-stage-ai hidden text-mini font-extrabold text-ai-soft">
              {t('ov.aiCount', { count: aiCountForLanes(stg.lanes) })}
            </div>
            <div className="text-nano font-extrabold text-flow">{t('ov.openFunctions')}</div>
          </div>
        ))}
      </div>

      <div className="mt-0.5 text-nano font-extrabold tracking-[.1em] text-slate-500">
        {t('ov.supporting')}
      </div>
      <div className="flex flex-wrap gap-3" id="ovSupport">
        {SUPPORT.map((sp) => (
          <div
            className="flex min-w-[155px] flex-1 cursor-pointer flex-col gap-[5px] rounded-[11px] border border-map-head bg-map-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-map-rail2"
            id={sp.id}
            key={sp.id}
            onClick={() => s.openStage(sp.id)}
          >
            <div className="flex flex-wrap items-center gap-[5px] text-note font-bold text-slate-300">
              {sp.icon} {sp.t}{' '}
              {sp.mods.map((m) => (
                <ModChip key={m}>{m}</ModChip>
              ))}
            </div>
            <div className="text-mini leading-[1.45] text-slate-500">{sp.d}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-center text-nano text-slate-600">{t('ov.hint')}</div>
    </div>
  );
}

/** L1 breadcrumb bar shown above the swimlane map once a stage is opened —
 *  it dims every lane not in the chosen stage. */
export function StageCrumb() {
  const s = useStore();
  const { t } = useI18n();
  if (!s.focusedStageId) return null;
  const stg = allStages().find((x) => x.id === s.focusedStageId);
  if (!stg) return null;

  return (
    <div
      className="sticky top-0 z-30 mb-3.5 flex items-center gap-[11px] rounded-[9px] border border-map-hair bg-map-card px-[13px] py-[7px]"
      id="l1Crumb"
    >
      <span className="text-body2 font-extrabold text-slate-200">
        {stg.icon ? stg.icon + ' ' : ''}
        {stg.t}
      </span>
      <span className="text-4xs text-slate-500">
        {stg.mods.length ? t('ov.modules') + stg.mods.join(' · ') : ''}
      </span>
      <button
        className="ml-auto cursor-pointer rounded-md border border-map-rail bg-transparent px-[11px] py-1 text-cap font-bold text-flow hover:border-flow hover:bg-flow/10"
        onClick={s.clearFocusStage}
      >
        {t('ov.showFullMap')}
      </button>
    </div>
  );
}
