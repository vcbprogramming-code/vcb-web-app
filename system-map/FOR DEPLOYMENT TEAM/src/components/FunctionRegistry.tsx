/** Function registry overlay — searchable table of functions by department.
 *  Mirrors openRegistry()/closeRegistry()/buildFnTabs()/getFnBadge()/
 *  filterFunctions()/toggleSiteOnly()/renderRegistry() in Index.html.
 */
import { useEffect, useRef } from 'react';
import type { Store } from '../store';
import { DEPT_META, FUNCTION_REGISTRY, FUNCTION_LOC, FIELD_ACT_CODES, FUNCTION_AI, LANG_TH } from '../data';
import type { FunctionRow } from '../data/types';
import { esc } from '../lib/i18n';

function getFnBadge(lang: 'en' | 'th', type: string): string {
  if (!type) return '';
  const isTh = lang === 'th';
  const L = LANG_TH.ui;
  const isErp = type.trim().toLowerCase() === 'erp';
  return isErp
    ? `<span class="fn-badge fn-badge-erp">${isTh ? (L.badgeErp as string) : 'ERP'}</span>`
    : `<span class="fn-badge fn-badge-nonepr">${isTh ? (L.badgeNonErp as string) : 'Non-ERP'}</span>`;
}

function rowHtml(lang: 'en' | 'th', fn: FunctionRow, showAiMode: boolean, siteMode: boolean): string {
  const isTh = lang === 'th';
  const th = isTh && LANG_TH.registry ? LANG_TH.registry[fn[0]] : null;
  const nm = th ? th[0] : fn[1];
  const nt = th ? th[1] : fn[4] || '';
  const aiO = FUNCTION_AI[fn[0]];
  const aiTip =
    showAiMode && aiO
      ? `<div class="fn-ai">✨ <b>AI:</b> ${esc(isTh && aiO.th ? aiO.th : aiO.en)}${aiO.tool ? ` <span class="fn-tool">🛠 ${esc(aiO.tool)}</span>` : ''}</div>`
      : '';
  const typeCell = getFnBadge(lang, fn[2]);
  const locBadge = FUNCTION_LOC.has(fn[0]) ? ' <span class="fn-loc" title="Done at site">📍</span>' : '';
  return `<td><span class="fn-code">${fn[0]}</span></td><td>${esc(nm)}${siteMode ? ' <span class="fn-loc" title="Done at site">📍</span>' : locBadge}</td><td>${typeCell}</td><td class="fn-module">${esc(fn[3] || '')}</td><td class="fn-notes">${esc(nt)}${aiTip}</td>`;
}

export default function FunctionRegistry({ s }: { s: Store }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isTh = s.lang === 'th';
  const L = LANG_TH.ui;

  // scroll-to + highlight a function code when opened via openRegistryToFunction()
  useEffect(() => {
    if (!s.registryOpen || !s.fnHighlightCode) return;
    const code = s.fnHighlightCode;
    const t = setTimeout(() => {
      const body = bodyRef.current;
      if (!body) return;
      let target: HTMLElement | null = null;
      body.querySelectorAll('tr').forEach((tr) => {
        const cd = tr.querySelector('.fn-code');
        if (cd && cd.textContent?.trim() === code) target = tr as HTMLElement;
      });
      if (target) {
        body.querySelectorAll('tr.fn-row-hl').forEach((tr) => tr.classList.remove('fn-row-hl'));
        (target as HTMLElement).classList.add('fn-row-hl');
        (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => (target as HTMLElement)?.classList.remove('fn-row-hl'), 2800);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [s.registryOpen, s.fnHighlightCode]);

  if (!s.registryOpen) return null;

  const q = s.fnSearch.toLowerCase().trim();
  const cc = isTh ? (L.fnColCode as string) || 'รหัส' : 'Code';
  const cf = isTh ? (L.fnColFunction as string) || 'ฟังก์ชัน' : 'Function';
  const ct = isTh ? (L.fnColType as string) || 'ประเภท' : 'Type';
  const cm = isTh ? (L.fnColModule as string) || 'โมดูล' : 'Module';
  const cn = isTh ? (L.fnColNotes as string) || 'หมายเหตุ' : 'Notes';

  const tabs = [
    { id: 'all', label: isTh ? (L.fnAllDepts as string) || 'ทุกแผนก' : 'All Departments' },
    ...Object.entries(DEPT_META).map(([k, v]) => ({
      id: k,
      label: v.icon + ' ' + (isTh && LANG_TH.depts ? (LANG_TH.depts as any)[k] || v.name : v.name),
    })),
    { id: '__site__', label: '📍 ' + (isTh ? 'หน้างาน' : 'Site') },
  ];

  let bodyContent: React.ReactNode;
  let statsText: string;

  if (s.fnActiveDept === '__site__') {
    let siteRows: FunctionRow[] = [];
    Object.values(FUNCTION_REGISTRY).forEach((fns) => {
      fns.forEach((fn) => {
        if (FUNCTION_LOC.has(fn[0])) siteRows.push(fn);
      });
    });
    if (q) siteRows = siteRows.filter((fn) => fn[0].toLowerCase().includes(q) || fn[1].toLowerCase().includes(q) || (fn[4] || '').toLowerCase().includes(q));
    statsText = siteRows.length + ' ' + (isTh ? (L.fnDeptCount as string) || 'ฟังก์ชัน' : 'functions') + ' · 📍 ' + (isTh ? 'หน้างาน' : 'Site only');
    bodyContent = siteRows.length ? (
      <table className="fn-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>{cc}</th>
            <th style={{ width: '28%' }}>{cf}</th>
            <th style={{ width: 110 }}>{ct}</th>
            <th style={{ width: 110 }}>{cm}</th>
            <th>{cn}</th>
          </tr>
        </thead>
        <tbody>
          {siteRows.map((fn) => (
            <tr
              key={fn[0]}
              className={(fn[5] ? 'ext-entry ' : '') + (FIELD_ACT_CODES.has(fn[0]) ? 'field-act-row' : '')}
              dangerouslySetInnerHTML={{ __html: rowHtml(s.lang, fn, s.showAiMode, true) }}
            />
          ))}
        </tbody>
      </table>
    ) : (
      <div className="fn-empty">{isTh ? (L.fnNoMatch as string) || 'ไม่พบ' : 'No site functions match.'}</div>
    );
  } else {
    const depts = s.fnActiveDept === 'all' ? Object.keys(FUNCTION_REGISTRY) : [s.fnActiveDept];
    let totalShown = 0;
    const totalAll = Object.values(FUNCTION_REGISTRY).flat().length;
    const extAll = Object.values(FUNCTION_REGISTRY)
      .flat()
      .filter((f) => f[5] === true).length;
    const aiAllCount = Object.values(FUNCTION_REGISTRY)
      .flat()
      .filter((f) => FUNCTION_AI[f[0]]).length;

    const sections: React.ReactNode[] = [];
    depts.forEach((dk) => {
      const fns = FUNCTION_REGISTRY[dk] || [];
      const meta = (DEPT_META as any)[dk] || { name: dk, color: '#334155', icon: '' };
      let filtered = q ? fns.filter((f) => f[0].toLowerCase().includes(q) || f[1].toLowerCase().includes(q) || (f[4] || '').toLowerCase().includes(q)) : fns;
      if (s.siteOnlyRegistry) filtered = filtered.filter((f) => FUNCTION_LOC.has(f[0]));
      if (!filtered.length) return;
      totalShown += filtered.length;

      if (s.fnActiveDept === 'all') {
        const dn = isTh && LANG_TH.depts ? (LANG_TH.depts as any)[dk] || meta.name : meta.name;
        const fw = isTh ? (L.fnDeptCount as string) || 'ฟังก์ชัน' : 'functions';
        sections.push(
          <div className="fn-dept-header" style={{ background: meta.color }} key={dk + '-hdr'}>
            {meta.icon} {dn} <span className="fn-dept-count">{filtered.length} {fw}</span>
          </div>,
        );
      }
      sections.push(
        <table className="fn-table" key={dk + '-tbl'}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>{cc}</th>
              <th style={{ width: '28%' }}>{cf}</th>
              <th style={{ width: 110 }}>{ct}</th>
              <th style={{ width: 110 }}>{cm}</th>
              <th>{cn}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fn) => (
              <tr
                key={fn[0]}
                className={(fn[5] ? 'ext-entry ' : '') + (FIELD_ACT_CODES.has(fn[0]) ? 'field-act-row' : '')}
                dangerouslySetInnerHTML={{ __html: rowHtml(s.lang, fn, s.showAiMode, false) }}
              />
            ))}
          </tbody>
        </table>,
      );
    });

    const shown = q ? totalShown : totalAll;
    statsText =
      shown +
      ' ' +
      (isTh ? (L.fnDeptCount as string) || 'ฟังก์ชัน' : 'functions') +
      ' · ' +
      extAll +
      ' ' +
      (isTh ? (L.fnExtPts as string) || 'จุดเข้าภายนอก' : 'external entry points') +
      ' · ' +
      FIELD_ACT_CODES.size +
      ' field activities' +
      (s.showAiMode ? ' · ' + aiAllCount + ' with AI opps' : '');

    bodyContent = totalShown || !q ? sections : <div className="fn-empty">{isTh ? (L.fnNoMatch as string) || 'ไม่พบ' : 'No functions match your search.'}</div>;
  }

  return (
    <div className="fn-overlay open">
      <div className="fn-header">
        <div className="fn-title">
          📋 {isTh ? (L.fnTitle as string) : 'Function Registry'} <span>{isTh ? (L.fnSubtitle as string) : 'VCB Construction · All Departments'}</span>
        </div>
        <input
          className="fn-search"
          id="fnSearch"
          type="text"
          placeholder={isTh ? (L.fnSearchPlaceholder as string) || 'ค้นหารหัสหรือชื่อ…' : 'Search code or name…'}
          value={s.fnSearch}
          onChange={(e) => s.setFnSearch(e.target.value)}
        />
        <button
          className="fn-close-btn"
          id="btnSiteOnly"
          onClick={s.toggleSiteOnly}
          style={{ background: s.siteOnlyRegistry ? '#E65100' : 'transparent', borderColor: '#E65100', color: s.siteOnlyRegistry ? '#fff' : '#E65100' }}
          title="Show site functions only"
        >
          📍 Site Only
        </button>
        <div className="fn-stats" id="fnStats">
          {statsText}
        </div>
        <button className="fn-close-btn" onClick={s.closeRegistry}>
          {isTh ? (L.fnClose as string) || '✕ กลับสู่แผนที่' : '✕ Back to Map'}
        </button>
      </div>
      <div className="fn-tabs" id="fnTabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={'fn-tab' + (s.fnActiveDept === tab.id ? ' active' : '')}
            onClick={() => s.setFnActiveDept(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="fn-body" id="fnBody" ref={bodyRef}>
        {bodyContent}
      </div>
    </div>
  );
}
