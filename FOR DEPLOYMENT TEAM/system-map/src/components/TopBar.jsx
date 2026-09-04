/** Brand banner + header: layer filters, direct/indirect toggles, registry/AI
 *  buttons, settings, and the department filter bar.
 *
 *  This module keeps its own bar rather than using the shared AppBar: the row
 *  under the banner carries the layer and department filters that ARE this
 *  app, and the live version puts them in the chrome too. The banner itself
 *  matches AppBar - brand link home, divider, title, subtitle - and language
 *  and appearance sit behind the gear like everywhere else.
 */
import { useState } from 'react';
import { AppBar, useI18n } from '@vcb/shared';
import { useStore } from '../store.jsx';
import { DEPTS } from '../data/index.js';
import { tDept } from '../lib/mapLang.js';

const DEPT_ORDER = ['eng', 'pm', 'proc', 'fin', 'acc', 'asset', 'hr'];

// Same as every other module: the deployment says where the portal is, and it
// defaults to the root because on one domain the portal IS the root.
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '/';

/** The header's small pill button. `tone` picks the accent ring.
 *
 * outline-none + a focus-visible ring: without it, the browser's default
 * focus outline sat on top of these pills after a click — most visible on
 * "— เส้นประ" (indirect), whose dashed amber border made a stray blue/orange
 * ring read as a stuck-active state rather than plain keyboard focus. */
const BTN =
  'inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border-[1.5px] ' +
  'px-[9px] py-1 text-nano font-semibold transition-all duration-150 ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-flow/50 focus-visible:ring-offset-1 focus-visible:ring-offset-map-head';

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
  // lang is still needed: tDept() picks the Thai or English department name.
  // Only the language TOGGLE moved into the settings sheet, not the value.
  const { t, lang } = useI18n();

  return (
    <>
      {/* The shared bar, as in every other module. This was a hand-rolled
          banner with the same shape but its own colours and spacing — 64px
          tall against everyone else's, its own brand size, and a settings gear
          that lived down in the filter row as a small chip rather than in the
          bar. The filter row below is genuinely this module's own and stays. */}
      <AppBar title={t('app.title')} subtitle={t('app.subtitle')} />

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
