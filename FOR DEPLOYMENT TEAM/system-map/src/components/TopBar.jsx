/** Brand banner + header: layer filters, direct/indirect toggles, registry/AI
 *  buttons, language switch, and the department filter bar.
 */
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { DEPTS } from '../data/index.js';
import { tDept } from '../lib/mapLang.js';

const DEPT_ORDER = ['eng', 'pm', 'proc', 'fin', 'acc', 'asset', 'hr'];

/** The header's small pill button. `tone` picks the accent ring. */
const BTN =
  'inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border-[1.5px] ' +
  'px-[9px] py-1 text-nano font-semibold transition-all duration-150';

function Btn({ active, tone = 'plain', className = '', ...rest }) {
  const tones = {
    plain: active
      ? 'border-flow bg-flow text-slate-900'
      : 'border-map-rail bg-transparent text-slate-400 hover:border-map-rail2 hover:text-slate-200',
    direct: active
      ? 'border-flow bg-flow/15 text-flow'
      : 'border-flow bg-transparent text-flow hover:bg-flow/15',
    indirect: active
      ? 'border-alt border-dashed bg-alt/10 text-alt'
      : 'border-alt border-dashed bg-transparent text-alt hover:bg-alt/10',
    fn: active
      ? 'border-ai bg-ai text-slate-900'
      : 'border-ai bg-transparent text-ai hover:bg-ai/[.12]',
    ai: active
      ? 'border-ai bg-ai text-slate-900'
      : 'border-ai bg-transparent text-ai hover:bg-ai/[.12]',
    lang: active
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-blue-600 bg-transparent text-blue-600 hover:bg-blue-600/10',
  };
  return <button className={`${BTN} ${tones[tone]} ${className}`} {...rest} />;
}

export default function TopBar() {
  const s = useStore();
  const { t, lang, toggleLang } = useI18n();

  return (
    <>
      <div className="brand-banner flex flex-shrink-0 items-center gap-4 bg-map-brand px-5 py-[13px] shadow-brand">
        <a
          className="rounded-md text-xl font-bold tracking-[.2px] text-white no-underline transition-opacity duration-150 hover:opacity-[.82] focus-visible:opacity-[.82] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/35"
          href="/"
          target="_top"
          title={t('app.backToPortal')}
        >
          {t('app.brand')}
        </a>
        <div className="h-[34px] w-px bg-white/[.28]" />
        <div className="flex flex-col gap-1">
          <span className="text-base2 font-semibold uppercase tracking-[.5px] text-white opacity-95">
            {t('app.title')}
          </span>
          <span className="text-base2 font-medium text-white opacity-[.85]">
            {t('app.subtitle')}
          </span>
        </div>
      </div>

      <div className="app-header relative z-50 flex flex-shrink-0 flex-col gap-[5px] border-b-2 border-map-rail bg-map-head px-5 py-[7px]">
        <div className="flex flex-nowrap items-center gap-1.5">
          <div className="whitespace-nowrap text-4xs font-bold uppercase tracking-[.05em] text-slate-600">
            {t('hdr.layer')}:
          </div>
          <Btn active={s.activeLayer === 'all'} onClick={() => s.setLayer('all')}>
            {t('hdr.all')}
          </Btn>
          <Btn active={s.activeLayer === 'erp'} onClick={() => s.setLayer('erp')}>
            {t('hdr.erp')}
          </Btn>
          <Btn active={s.activeLayer === 'manual'} onClick={() => s.setLayer('manual')}>
            {t('hdr.manual')}
          </Btn>
          <div className="h-5 w-px flex-shrink-0 bg-map-rail" />
          <Btn tone="direct" active={!s.hideDirect} onClick={s.toggleDirect}>
            {t('hdr.directFlow')}
          </Btn>
          <Btn tone="indirect" active={!s.hideIndirect} onClick={s.toggleIndirect}>
            {t('hdr.indirect')}
          </Btn>

          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
            <Btn tone="fn" active={s.registryOpen} onClick={s.toggleRegistry}>
              {s.registryOpen ? t('hdr.returnToMap') : t('hdr.functions')}
            </Btn>
            <Btn tone="ai" active={s.showAiMode} onClick={s.toggleAiMode}>
              {t('hdr.aiOpps')}
            </Btn>
            <Btn tone="lang" active={lang === 'th'} onClick={toggleLang}>
              {lang === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <div className="whitespace-nowrap text-4xs font-bold uppercase tracking-[.05em] text-slate-600">
            {t('hdr.dept')}:
          </div>
          <div className="flex flex-wrap items-center gap-1" id="deptBar">
            {DEPT_ORDER.map((k) => {
              const d = DEPTS[k];
              return (
                <button
                  key={k}
                  className={
                    `${BTN} border-transparent text-white hover:opacity-100 ` +
                    (s.activeDept === k ? 'opacity-100' : 'opacity-50')
                  }
                  data-dept={k}
                  style={{ background: d.color }}
                  onClick={() => s.toggleDept(k)}
                >
                  {d.icon} {tDept(lang, k, d.name)}
                </button>
              );
            })}
          </div>
          <button
            className={`${BTN} border-map-rail bg-transparent px-2 py-1 text-4xs text-slate-400 hover:border-map-rail2 hover:text-slate-200`}
            id="btn-dept-clear"
            title={t('hdr.clearAll')}
            onClick={s.clearAll}
          >
            ✕
          </button>
          <div className="ml-auto whitespace-nowrap rounded border border-map-rail px-[7px] py-0.5 text-4xs text-slate-600">
            {t('app.version')}
          </div>
        </div>
      </div>
    </>
  );
}
