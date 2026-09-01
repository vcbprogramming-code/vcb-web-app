/** Function registry overlay — searchable table of functions by department.
 *
 *  The original built each row as an HTML string and injected it with
 *  dangerouslySetInnerHTML through an esc() helper. Rows are real JSX here:
 *  React escapes text children on its own, so the helper and the injection both
 *  go away without changing what renders.
 *
 *  One source defect stays fixed rather than mirrored: opening the AI-function
 *  count while the registry is open throws a ReferenceError in the original.
 *  The count is computed properly below.
 */
import { useEffect, useRef } from 'react';
import { useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import {
  DEPT_META,
  FUNCTION_REGISTRY,
  FUNCTION_LOC,
  FIELD_ACT_CODES,
  FUNCTION_AI,
} from '../data/index.js';
import { tDept, tRegistryRow } from '../lib/mapLang.js';

const TH =
  'sticky top-0 z-[2] border-b-2 border-map-rail bg-map-head px-3 py-2.5 text-left text-4xs font-extrabold uppercase tracking-[.08em] text-slate-500';
const TD = 'border-b border-map-head px-3 py-2 align-top text-base2 leading-[1.4] text-slate-200';

/** A registry row: [code, name, erpType, module, notes, isExternalEntry?] */
function Row({ fn, showAiMode, siteMode }) {
  const { t, lang } = useI18n();

  const th = tRegistryRow(lang, fn[0]);
  const name = th ? th[0] : fn[1];
  const notes = th ? th[1] : fn[4] || '';
  const aiO = FUNCTION_AI[fn[0]];
  const isErp = (fn[2] || '').trim().toLowerCase() === 'erp';
  const showLoc = siteMode || FUNCTION_LOC.has(fn[0]);

  return (
    <tr
      className={
        (fn[5] ? 'ext-entry ' : '') + (FIELD_ACT_CODES.has(fn[0]) ? 'field-act-row' : '')
      }
    >
      <td className={TD}>
        <span className="fn-code">{fn[0]}</span>
      </td>
      <td className={TD}>
        {name}
        {showLoc ? (
          <>
            {' '}
            <span className="fn-loc" title={t('fn.atSiteTitle')}>
              📍
            </span>
          </>
        ) : null}
      </td>
      <td className={TD}>
        <span className={'fn-badge ' + (isErp ? 'fn-badge-erp' : 'fn-badge-nonepr')}>
          {isErp ? t('fn.badgeErp') : t('fn.badgeNonErp')}
        </span>
      </td>
      <td className={`${TD} fn-module`}>{fn[3] || ''}</td>
      <td className={`${TD} fn-notes`}>
        {notes}
        {showAiMode && aiO ? (
          <div className="fn-ai">
            ✨ <b>{t('fn.aiPrefix')}</b> {lang === 'th' && aiO.th ? aiO.th : aiO.en}
            {aiO.tool ? <span className="fn-tool">🛠 {aiO.tool}</span> : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function Table({ rows, showAiMode, siteMode }) {
  const { t } = useI18n();
  return (
    <table className="fn-table w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th className={TH} style={{ width: 90 }}>
            {t('fn.colCode')}
          </th>
          <th className={TH} style={{ width: '28%' }}>
            {t('fn.colFunction')}
          </th>
          <th className={TH} style={{ width: 110 }}>
            {t('fn.colType')}
          </th>
          <th className={TH} style={{ width: 110 }}>
            {t('fn.colModule')}
          </th>
          <th className={TH}>{t('fn.colNotes')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((fn) => (
          <Row key={fn[0]} fn={fn} showAiMode={showAiMode} siteMode={siteMode} />
        ))}
      </tbody>
    </table>
  );
}

/** Search matches code, name, or notes. */
function matches(fn, q) {
  return (
    fn[0].toLowerCase().includes(q) ||
    fn[1].toLowerCase().includes(q) ||
    (fn[4] || '').toLowerCase().includes(q)
  );
}

export default function FunctionRegistry() {
  const s = useStore();
  const { t, lang } = useI18n();
  const bodyRef = useRef(null);

  // Scroll to and briefly highlight a function opened via a sidebar chip.
  useEffect(() => {
    if (!s.registryOpen || !s.fnHighlightCode) return;
    const code = s.fnHighlightCode;
    const timer = setTimeout(() => {
      const body = bodyRef.current;
      if (!body) return;
      let target = null;
      body.querySelectorAll('tr').forEach((tr) => {
        const cd = tr.querySelector('.fn-code');
        if (cd && cd.textContent?.trim() === code) target = tr;
      });
      if (!target) return;
      body.querySelectorAll('tr.fn-row-hl').forEach((tr) => tr.classList.remove('fn-row-hl'));
      target.classList.add('fn-row-hl');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => target.classList.remove('fn-row-hl'), 2800);
    }, 60);
    return () => clearTimeout(timer);
  }, [s.registryOpen, s.fnHighlightCode]);

  if (!s.registryOpen) return null;

  const q = s.fnSearch.toLowerCase().trim();

  const tabs = [
    { id: 'all', label: t('fn.allDepts') },
    ...Object.entries(DEPT_META).map(([k, v]) => ({
      id: k,
      label: v.icon + ' ' + tDept(lang, k, v.name),
    })),
    { id: '__site__', label: '📍 ' + t('fn.site') },
  ];

  let bodyContent;
  let statsText;

  if (s.fnActiveDept === '__site__') {
    let siteRows = [];
    Object.values(FUNCTION_REGISTRY).forEach((fns) => {
      fns.forEach((fn) => {
        if (FUNCTION_LOC.has(fn[0])) siteRows.push(fn);
      });
    });
    if (q) siteRows = siteRows.filter((fn) => matches(fn, q));

    statsText = `${siteRows.length} ${t('fn.count')} · 📍 ${t('fn.siteOnly')}`;
    bodyContent = siteRows.length ? (
      <Table rows={siteRows} showAiMode={s.showAiMode} siteMode />
    ) : (
      <div className="px-6 py-[50px] text-center text-map-rail">{t('fn.noSiteMatch')}</div>
    );
  } else {
    const depts = s.fnActiveDept === 'all' ? Object.keys(FUNCTION_REGISTRY) : [s.fnActiveDept];
    const allRows = Object.values(FUNCTION_REGISTRY).flat();
    const totalAll = allRows.length;
    const extAll = allRows.filter((f) => f[5] === true).length;
    const aiAllCount = allRows.filter((f) => FUNCTION_AI[f[0]]).length;

    let totalShown = 0;
    const sections = [];

    depts.forEach((dk) => {
      const fns = FUNCTION_REGISTRY[dk] || [];
      const meta = DEPT_META[dk] || { name: dk, color: '#334155', icon: '' };
      let filtered = q ? fns.filter((f) => matches(f, q)) : fns;
      if (s.siteOnlyRegistry) filtered = filtered.filter((f) => FUNCTION_LOC.has(f[0]));
      if (!filtered.length) return;
      totalShown += filtered.length;

      if (s.fnActiveDept === 'all') {
        sections.push(
          <div
            className="my-[14px] mb-1 flex items-center gap-2 rounded-[7px] px-3 py-[7px] text-nano font-extrabold uppercase tracking-[.09em] text-white"
            style={{ background: meta.color }}
            key={dk + '-hdr'}
          >
            {meta.icon} {tDept(lang, dk, meta.name)}{' '}
            <span className="rounded-pill bg-white/15 px-2 py-0.5 text-tiny font-semibold">
              {filtered.length} {t('fn.count')}
            </span>
          </div>,
        );
      }
      sections.push(
        <Table key={dk + '-tbl'} rows={filtered} showAiMode={s.showAiMode} siteMode={false} />,
      );
    });

    const shown = q ? totalShown : totalAll;
    statsText =
      `${shown} ${t('fn.count')} · ${extAll} ${t('fn.extPoints')} · ` +
      `${FIELD_ACT_CODES.size} ${t('fn.fieldActivities')}` +
      (s.showAiMode ? ` · ${aiAllCount} ${t('fn.withAiOpps')}` : '');

    bodyContent =
      totalShown || !q ? (
        sections
      ) : (
        <div className="px-6 py-[50px] text-center text-map-rail">{t('fn.noMatch')}</div>
      );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-[450] flex flex-col bg-map-bg">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3.5 border-b border-map-rail bg-map-head px-[22px] py-[13px]">
        <div className="whitespace-nowrap text-base font-extrabold text-ai">
          📋 {t('fn.title')}{' '}
          <span className="ml-2 text-base2 font-normal text-slate-500">{t('fn.subtitle')}</span>
        </div>

        <input
          className="min-w-[180px] max-w-[320px] flex-1 rounded-[7px] border-[1.5px] border-map-rail bg-map-sunk px-3 py-[7px] text-body2 text-slate-200 outline-none focus:border-ai"
          id="fnSearch"
          type="text"
          placeholder={t('fn.searchPlaceholder')}
          value={s.fnSearch}
          onChange={(e) => s.setFnSearch(e.target.value)}
        />

        <button
          className="cursor-pointer rounded-[7px] border-[1.5px] px-3.5 py-[7px] text-base2 font-semibold"
          onClick={s.toggleSiteOnly}
          style={{
            background: s.siteOnlyRegistry ? '#E65100' : 'transparent',
            borderColor: '#E65100',
            color: s.siteOnlyRegistry ? '#fff' : '#E65100',
          }}
          title={t('fn.siteOnlyTitle')}
        >
          {t('fn.siteOnlyBtn')}
        </button>

        <div className="ml-auto whitespace-nowrap text-base2 text-slate-500">{statsText}</div>

        <button
          className="cursor-pointer rounded-[7px] border-[1.5px] border-map-rail bg-transparent px-3.5 py-[7px] text-base2 font-semibold text-slate-400 hover:bg-map-head hover:text-slate-200"
          onClick={s.closeRegistry}
        >
          {t('fn.close')}
        </button>
      </div>

      <div className="flex flex-shrink-0 border-b border-map-rail bg-map-head px-3.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              'cursor-pointer whitespace-nowrap border-none border-b-[3px] bg-transparent px-3.5 py-[9px] text-base2 font-bold transition-all duration-150 ' +
              (s.fnActiveDept === tab.id
                ? 'border-b-ai text-ai'
                : 'border-b-transparent text-slate-500 hover:text-slate-200')
            }
            onClick={() => s.setFnActiveDept(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] py-[18px]" id="fnBody" ref={bodyRef}>
        {bodyContent}
      </div>
    </div>
  );
}
