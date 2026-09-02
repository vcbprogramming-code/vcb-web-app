/** Collapsible map key, pinned bottom-left over the map. */
import { useState } from 'react';
import { useI18n } from '@vcb/shared';

function Row({ swatch, children }) {
  return (
    <div className="flex items-center gap-2 leading-[1.25]">
      {swatch}
      <span>{children}</span>
    </div>
  );
}

/** A colour chip. */
function Sw({ style }) {
  return <span className="inline-block h-[13px] w-6 flex-shrink-0 rounded-[3px]" style={style} />;
}

/** A glyph in the swatch column. */
function Ln({ color, children }) {
  return (
    <span className="w-5 flex-shrink-0 text-center font-black" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

export default function Legend() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div
      className="fixed bottom-3.5 left-3.5 z-[45] max-w-[250px] select-none rounded-[10px] border border-map-hair bg-map-panel/95 text-mini text-slate-300 shadow-legend"
      id="mapLegend"
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-1.5 px-[11px] py-1.5 text-left font-extrabold text-slate-200"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span>🔑</span>
        <span>{t('legend.key')}</span>
        <span
          className={
            'ml-auto opacity-60 transition-transform ' + (collapsed ? '-rotate-90' : '')
          }
        >
          ▾
        </span>
      </button>

      {!collapsed ? (
        <div className="flex flex-col gap-[5px] px-[11px] pb-[9px]">
          <Row swatch={<Sw style={{ background: '#00695C' }} />}>{t('legend.erpStep')}</Row>
          <Row
            swatch={<Sw style={{ background: '#101c34', border: '2px dashed #64748b' }} />}
          >
            {t('legend.manualStep')}
          </Row>
          <Row swatch={<Ln>📍</Ln>}>{t('legend.atSite')}</Row>
          <Row swatch={<Ln color="#94a3b8">●</Ln>}>{t('legend.cornerDot')}</Row>
          <Row swatch={<Ln color="#38bdf8">—</Ln>}>{t('legend.direct')}</Row>
          <Row swatch={<Ln color="#ffc233">╌</Ln>}>{t('legend.indirect')}</Row>
          <Row swatch={<Ln color="#c9a14a">↩</Ln>}>{t('legend.feedback')}</Row>
          <Row swatch={<Ln color="#fbbf24">⚠</Ln>}>{t('legend.toConfirm')}</Row>
        </div>
      ) : null}
    </div>
  );
}
