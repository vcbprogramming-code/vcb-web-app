/** Collapsible map key. Mirrors the `.map-legend` markup and its inline
 *  onclick toggle + toggleLang()'s leg-* label updates in Index.html.
 */
import { useState } from 'react';
import type { Store } from '../store';

// The original toggleLang() sets these legend labels with hardcoded literal
// strings (not a LANG_TH.ui lookup) — mirrored verbatim here, not invented.
const ERP_LBL: Record<'en' | 'th', string> = { en: 'ERP step (solid)', th: 'ขั้นตอน Mango ERP' };
const MANUAL_LBL: Record<'en' | 'th', string> = { en: 'Manual / off-ERP (dashed)', th: 'งานด้วยมือ (ช่องว่าง)' };
const KEY_LBL: Record<'en' | 'th', string> = { en: 'Key', th: 'Key' };

export default function Legend({ s }: { s: Store }) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className={'map-legend' + (collapsed ? ' collapsed' : '')} id="mapLegend">
      <div className="ml-head" onClick={() => setCollapsed((c) => !c)}>
        <span>🔑</span>
        <span>{KEY_LBL[s.lang]}</span>
        <span className="ml-caret" style={{ marginLeft: 'auto', opacity: 0.6 }}>
          ▾
        </span>
      </div>
      <div className="ml-body">
        <div className="ml-row">
          <span className="ml-sw" style={{ background: '#00695C' }}></span>
          <span id="leg-erp-lbl">{ERP_LBL[s.lang]}</span>
        </div>
        <div className="ml-row">
          <span className="ml-sw" style={{ background: '#101c34', border: '2px dashed #64748b' }}></span>
          <span id="leg-manual-lbl">{MANUAL_LBL[s.lang]}</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln">📍</span>
          <span>Done at the site</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln" style={{ color: '#94a3b8' }}>
            ●
          </span>
          <span>Corner dot = secondary owner</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln" style={{ color: '#38bdf8' }}>
            —
          </span>
          <span>Direct flow</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln" style={{ color: '#ffc233' }}>
            ╌
          </span>
          <span>Indirect / conditional</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln" style={{ color: '#c9a14a' }}>
            ↩
          </span>
          <span>Feedback / loop</span>
        </div>
        <div className="ml-row">
          <span className="ml-ln" style={{ color: '#fbbf24' }}>
            ⚠
          </span>
          <span>To confirm (indicative)</span>
        </div>
      </div>
    </div>
  );
}
