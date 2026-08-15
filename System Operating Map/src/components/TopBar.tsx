/** Brand banner + header (layer filters, direct/indirect toggles, registry/AI/lang
 *  buttons, department filter bar). Mirrors the `.brand-banner` + `.app-header`
 *  markup and the layer-filter / dept-filter / toggleDirect / toggleIndirect /
 *  toggleRegistry / toggleAiMode / toggleLang / clearAll handlers in Index.html.
 */
import type { Store } from '../store';
import { DEPTS } from '../data';

const DEPT_ORDER: Array<keyof typeof DEPTS> = ['eng', 'pm', 'proc', 'fin', 'acc', 'asset', 'hr'];

export default function TopBar({ s }: { s: Store }) {
  return (
    <>
      <div className="brand-banner">
        <a
          className="brand-link"
          href="https://script.google.com/a/macros/vcb-con.com/s/AKfycbxqIk8Qql3XWXIWn_p0f0FSd04i-FcWZjoXgRErlU5bTXUkpujbQ4ZN4mWco6HEQFUB/exec"
          target="_top"
          title="Back to VCB Connect portal"
        >
          VCB Group
        </a>
        <div className="brand-div"></div>
        <div className="brand-stack">
          <span className="brand-sub">System Operating Map</span>
          <span className="brand-th">แผนผังการทำงานของระบบ</span>
        </div>
      </div>

      <div className="app-header">
        <div className="hrow">
          <div className="dept-bar-label">Layer:</div>
          <button
            className={'btn' + (s.activeLayer === 'all' ? ' active' : '')}
            onClick={() => s.setLayer('all')}
          >
            All
          </button>
          <button
            className={'btn' + (s.activeLayer === 'erp' ? ' active' : '')}
            onClick={() => s.setLayer('erp')}
          >
            ⚙️ ERP
          </button>
          <button
            className={'btn' + (s.activeLayer === 'manual' ? ' active' : '')}
            onClick={() => s.setLayer('manual')}
          >
            📋 Manual
          </button>
          <div className="ctrl-sep"></div>
          <button
            className={'btn btn-direct' + (!s.hideDirect ? ' active' : '')}
            onClick={s.toggleDirect}
          >
            — Direct Flow
          </button>
          <button
            className={'btn btn-indirect' + (!s.hideIndirect ? ' active' : '')}
            onClick={s.toggleIndirect}
          >
            ╌ Indirect
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button className={'btn btn-fn' + (s.registryOpen ? ' active' : '')} onClick={s.toggleRegistry}>
              {s.registryOpen ? (s.lang === 'th' ? '↩ กลับสู่แผนที่' : '↩ Return to Map') : '📋 Functions'}
            </button>
            <button className={'btn btn-ai' + (s.showAiMode ? ' active' : '')} onClick={s.toggleAiMode}>
              🤖 AI Opps
            </button>
            <button className={'btn btn-lang' + (s.lang === 'th' ? ' active' : '')} onClick={s.toggleLang}>
              {s.lang === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
            </button>
          </div>
        </div>
        <div className="hrow hrow-2">
          <div className="dept-bar-label">Dept:</div>
          <div className="dept-bar" id="deptBar">
            {DEPT_ORDER.map((k) => {
              const d = DEPTS[k];
              return (
                <button
                  key={k}
                  className={'btn btn-dept' + (s.activeDept === k ? ' active' : '')}
                  data-dept={k}
                  style={{ background: d.color }}
                  onClick={() => s.toggleDept(k)}
                >
                  {d.icon} {d.name}
                </button>
              );
            })}
          </div>
          <button
            className="btn"
            id="btn-dept-clear"
            title="Clear all — deselect, reset lines, clear filters, exit trace"
            style={{ fontSize: 10, padding: '4px 8px' }}
            onClick={s.clearAll}
          >
            ✕
          </button>
          <div className="version-tag" style={{ marginLeft: 'auto' }}>
            v8.86 · Jun 2026
          </div>
        </div>
      </div>
    </>
  );
}
