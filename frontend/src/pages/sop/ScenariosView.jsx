import { useCallback, useEffect, useRef, useState } from 'react';
import { sopApi, toneOf } from '../../lib/sop.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import ShareButton from './ShareButton.jsx';
import ScenarioModal from './ScenarioModal.jsx';
import { useT } from '../../lib/i18n.jsx';

/** Case studies: searchable list on the left, full case on the right. */
export default function ScenariosView({ modules, module, canEdit, onChanged, sharedNo }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  // a ?case=N link opens that case straight away, before anyone clicks
  const [openNo, setOpenNo] = useState(sharedNo ? Number(sharedNo) : null);
  const [detail, setDetail] = useState(null);
  const [rev, setRev] = useState(0); // bumped after a save so the open case refetches
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit

  const load = useCallback(() => {
    setErr(null);
    return sopApi.scenarios({ module, q })
      .then((r) => setList(r.data))
      .catch((e) => setErr(e.message));
  }, [module, q]);

  useEffect(() => { setList(null); const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  // Changing the module filter clears the open case. Compare against the previous
  // value rather than counting renders: React runs effects twice on mount in
  // development, and a "skip the first run" flag gets used up by the first pass —
  // the second then wiped a ?case=N link before anyone saw it.
  // The module header is itself sticky at the top of the viewport. A bar pinned
  // to top:0 parks underneath it and is never seen, so sit just below — measured,
  // not hardcoded, because the header grows when its content wraps on a phone.
  const [barTop, setBarTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector('header.sticky');
      setBarTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const lastModule = useRef(module);
  useEffect(() => {
    if (lastModule.current === module) return;
    lastModule.current = module;
    setOpenNo(null); setDetail(null);
  }, [module]);

  useEffect(() => {
    if (openNo == null) { setDetail(null); return; }
    setDetail(null);
    sopApi.scenario(openNo).then((r) => setDetail(r.data)).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNo, rev]);

  const remove = async (s) => {
    const ok = await confirm({
      title: t('ลบกรณีศึกษา'),
      message: `ลบ "${s.title_th}"?\nขั้นตอนทั้งหมดของกรณีนี้จะถูกลบด้วย`,
      confirmLabel: t('ลบ'), danger: true,
    });
    if (!ok) return;
    try {
      await sopApi.deleteScenario(s.no);
      toast.success(t('ลบกรณีศึกษาแล้ว'));
      if (openNo === s.no) setOpenNo(null);
      load(); onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const move = async (s, direction) => {
    try {
      const r = await sopApi.moveScenario(s.no, direction);
      if (r.data?.moved === false) { toast.error(t('อยู่ตำแหน่งสุดขอบแล้ว')); return; }
      load(); setRev((n) => n + 1); // display_no shifts with the new order
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหากรณีศึกษา')}
            placeholder={t('ค้นหาจากชื่อเรื่อง ปัญหา หรือขั้นตอน…')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
        {canEdit && (
          <button onClick={() => setEdit(null)} className="btn-primary !py-2 !text-sm">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มกรณีศึกษา')}
          </button>
        )}
      </div>

      {err ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}<button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
        </div>
      ) : !list ? (
        <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลดกรณีศึกษา…')} /></div>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          {q ? `ไม่พบกรณีศึกษาที่ตรงกับ “${q}”` : 'ยังไม่มีกรณีศึกษาในหมวดนี้'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
          {/* list — on a phone the two panes swap instead of stacking, so an
              open case isn't buried under 30 list rows */}
          <div className={`max-h-[70vh] space-y-1.5 overflow-y-auto pr-1 ${openNo != null ? 'hidden lg:block' : ''}`}>
            {list.map((s) => (
              <button key={s.no} onClick={() => setOpenNo(s.no)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  openNo === s.no ? 'border-brand bg-brand-tint' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                <div className="flex items-center gap-2">
                  <span className={`chip shrink-0 ${toneOf(s.module)}`}>{s.display_no}</span>
                  {s.extra_modules?.length > 0 && (
                    <span className="text-[10px] text-slate-500">+{s.extra_modules.join(' +')}</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800">{s.title_th}</div>
                {s.title_en && <div className="truncate text-[11px] text-slate-500">{s.title_en}</div>}
              </button>
            ))}
          </div>

          {/* detail */}
          <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${openNo == null ? 'hidden lg:block' : ''}`}>
            {/* On a phone the detail fills the screen and its title row scrolls
                away, taking แชร์/แก้ไข with it. Keep them on the back bar, which
                stays put — the same place the reader already looks to get out. */}
            {openNo != null && (
              <div style={{ top: barTop }} className="sticky z-10 -mx-5 mb-3 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2 lg:hidden">
                <button onClick={() => setOpenNo(null)} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                  <Icon name="arrowLeft" className="h-4 w-4" /> {t('กลับไปที่รายการ')}
                </button>
                {detail && (
                  <div className="flex shrink-0 items-center gap-1">
                    <ShareButton param="case" value={detail.no} />
                    {canEdit && (
                      <button onClick={() => setEdit(detail)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-brand">
                        {t('แก้ไข')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {openNo == null ? (
              <p className="py-16 text-center text-sm text-slate-500">{t('เลือกกรณีศึกษาทางซ้ายเพื่อดูรายละเอียด')}</p>
            ) : !detail ? (
              <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>
            ) : (
              <article className="space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${toneOf(detail.module)}`}>{detail.display_no}</span>
                      {detail.extra_modules?.map((m) => <span key={m} className="chip bg-slate-100 text-slate-600">{m}</span>)}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-800">{detail.title_th}</h3>
                    {detail.title_en && <p className="text-sm text-slate-500">{detail.title_en}</p>}
                  </div>
                  <div className="hidden shrink-0 flex-wrap items-center gap-1 lg:flex">
                    <ShareButton param="case" value={detail.no} />
                  {canEdit && (
                    <>
                      <button onClick={() => move(detail, 'up')} title={t('เลื่อนขึ้น')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                        <Icon name="arrowLeft" className="h-4 w-4 rotate-90" />
                      </button>
                      <button onClick={() => move(detail, 'down')} title={t('เลื่อนลง')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                        <Icon name="arrowRight" className="h-4 w-4 rotate-90" />
                      </button>
                      <button onClick={() => setEdit(detail)} className="text-sm font-medium text-brand hover:underline">{t('แก้ไข')}</button>
                      <button onClick={() => remove(detail)} className="ml-2 text-sm text-rose-500 hover:underline">{t('ลบ')}</button>
                    </>
                  )}
                  </div>
                </header>

                {detail.problem && (
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ปัญหา / สถานการณ์')}</h4>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{detail.problem}</p>
                  </section>
                )}

                {detail.steps?.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('แนวปฏิบัติ')}</h4>
                    <ol className="space-y-2">
                      {detail.steps.map((st, i) => (
                        <li key={i} className={`flex gap-2 text-sm leading-relaxed text-slate-700 ${st.is_substep ? 'ml-6' : ''}`}>
                          <span className="shrink-0 text-slate-400">{st.is_substep ? '»' : `${detail.steps.slice(0, i + 1).filter((x) => !x.is_substep).length}.`}</span>
                          <span className="whitespace-pre-line">{st.text}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {detail.note && (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <b>[!]</b> {detail.note}
                  </p>
                )}
                {detail.ref && <p className="text-xs text-slate-500">{t('อ้างอิง:')} {detail.ref}</p>}
              </article>
            )}
          </div>
        </div>
      )}

      {edit !== undefined && (
        <ScenarioModal item={edit} modules={modules}
          onClose={() => setEdit(undefined)}
          onSaved={(no) => {
            setEdit(undefined); load(); onChanged?.();
            if (no) setOpenNo(no);        // a new case opens straight away
            else setRev((n) => n + 1);    // an edited one refetches in place
          }} />
      )}
    </div>
  );
}
