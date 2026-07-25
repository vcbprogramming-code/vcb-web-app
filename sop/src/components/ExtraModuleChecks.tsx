/** Shared "หมวดเพิ่มเติม" (extra modules) checkbox grid used by EditModal and
 *  NewScenarioModal — lets a case be tagged into other modules' lists beyond
 *  its primary one. Mirrors renderExtraModuleChecks() in index.html. */
import type { Store } from '../store';
import { MODULES, MODULES_EN } from '../data/config';

export default function ExtraModuleChecks({
  s,
  primaryMod,
  checked,
  onChange,
}: {
  s: Store;
  primaryMod: string;
  checked: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const labels = s.lang === 'en' ? MODULES_EN : MODULES;

  function toggle(m: string) {
    const next = new Set(checked);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onChange(next);
  }

  return (
    <div className="row">
      <label>หมวดเพิ่มเติม</label>
      <div>
        <div className="chk-grid">
          {Object.keys(MODULES)
            .filter((m) => m !== primaryMod)
            .map((m) => {
              const id = 'ed_xm_' + m;
              return (
                <label key={m} htmlFor={id}>
                  <input id={id} type="checkbox" checked={checked.has(m)} onChange={() => toggle(m)} />
                  {m} · {(labels as Record<string, string>)[m] || m}
                </label>
              );
            })}
        </div>
        <div className="hint">กรณีนี้เกี่ยวข้องกับหลายหมวด · เลือกหมวดอื่นที่ต้องการให้แสดงกรณีนี้ด้วย (ไม่บังคับ)</div>
      </div>
    </div>
  );
}
