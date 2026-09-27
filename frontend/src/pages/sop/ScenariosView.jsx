import { useCallback, useEffect, useRef, useState } from 'react';
import { sopApi, toneOf, driveFileId, driveThumbUrl, titlePair } from '../../lib/sop.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import ShareButton from './ShareButton.jsx';
import ScenarioModal from './ScenarioModal.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/** ขั้นตอนสี่ระดับ — ตัวเลขในวงกลม · จุด · จุดเล็ก(ย่อย) · สี่เหลี่ยมเล็ก(ย่อยชั้นสอง) */
function Step({ style, n, text }) {
  if (style === 'num') {
    return (
      <li className="flex gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
        <span className="whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-800">{text}</span>
      </li>
    );
  }
  const indent = { bullet: 'ml-9', sub: 'ml-9', sub2: 'ml-16' }[style] || 'ml-9';
  const mark = style === 'sub2'
    ? <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-slate-400" />
    : <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />;
  return (
    <li className={`flex gap-2.5 ${indent}`}>
      {mark}
      <span className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{text}</span>
    </li>
  );
}

/** คอลัมน์แคบขวาสุด: รูปย่อของเอกสารแนบพร้อมชื่อไฟล์ใต้รูป เหมือนระบบจริง */
function AttachmentRail({ items }) {
  const t = useT();
  return (
    <aside className="shrink-0 space-y-2 xl:w-[158px]">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('เอกสารที่เกี่ยวข้อง')}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{t('ไม่มีเอกสารแนบ')}</p>
      ) : (
        <div className="flex flex-wrap gap-2 xl:block xl:space-y-2">
          {items.map((a, i) => {
            const id = driveFileId(a.url);
            // ไฟล์ที่ยังไม่ได้ตั้งชื่อถูกเก็บด้วย label = url (แบบเดียวกับระบบจริง)
            // ถ้าเอามาแสดงตรง ๆ คนจะเห็นลิงก์ Drive ดิบยาวเป็นชื่อไฟล์
            const label = (a.label && a.label !== a.url) ? a.label : t('เอกสารแนบ', null, 'sop');
            return (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                title={label}
                className="group block w-[140px] overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand/50 xl:w-full">
                <span className="relative flex h-[92px] items-center justify-center overflow-hidden bg-slate-50">
                  {/* ไอคอนอยู่ข้างหลัง รูปย่อจาก Google Drive ทับข้างบน — โหลดรูปไม่ได้
                      (ไฟล์ไม่ได้แชร์ / ออฟไลน์) ก็ซ่อนรูปแล้วเหลือไอคอนเอกสารแทน */}
                  <Icon name="document" className="h-7 w-7 text-slate-300" />
                  {id && (
                    <img src={driveThumbUrl(id, 400)} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
                <span className="block px-2 py-1.5 text-[11px] font-medium leading-tight text-slate-600 group-hover:text-brand">
                  {label}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/**
 * หัวหมวดบนรายการ — ชื่อเต็มของหมวด ชื่อภาษาอีกภาษา และคำอธิบายว่าหมวดนี้ทำอะไร
 *
 * ระบบจริงขึ้นกล่องนี้เหนือรายการทุกครั้งที่เลือกหมวด (ขึ้นแม้หมวดนั้นยังไม่มีกรณี)
 * ของเราเก็บคำอธิบายหมวดไว้ในฐานข้อมูลอยู่แล้วแต่ซ่อนเป็น tooltip เท่านั้น
 */
function ModuleHero({ mod, lang }) {
  if (!mod) return null;
  const primary = lang === 'en' ? (mod.name_en || mod.name_th) : (mod.name_th || mod.name_en);
  const secondary = lang === 'en' ? (mod.name_th || '') : (mod.name_en || '');
  const desc = lang === 'en' ? (mod.desc_en || mod.desc_th) : (mod.desc_th || mod.desc_en);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`chip shrink-0 font-semibold ${toneOf(mod.code)}`}>{mod.code}</span>
        <span className="min-w-0 truncate text-sm font-bold text-slate-800">{primary}</span>
      </div>
      {secondary && <div className="mt-0.5 truncate text-[11px] text-slate-500">{secondary}</div>}
      {desc && <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{desc}</p>}
    </div>
  );
}

/**
 * หน้าต้อนรับในแถบรายละเอียด — ชื่อคู่มือ ฉบับ วันมีผล จำนวนกรณี/รายงาน และคู่มืออ้างอิง
 *
 * ระบบจริงใช้แถบขวาเล่าว่ากำลังอ่านคู่มือฉบับไหนอยู่ ตอนที่ยังไม่ได้เลือกกรณี
 * ของเราเคยขึ้นแค่ประโยคเดียวว่าให้เลือกจากทางซ้าย คนจึงไม่รู้ว่าฉบับไหน
 */
function WelcomePanel({ meta, total, reports }) {
  const t = useT();
  const stats = [
    meta?.version && `${t('เวอร์ชัน:')} ${meta.version}`,
    meta?.effective && `${t('มีผล:')} ${meta.effective}`,
    `${total ?? 0} ${t('กรณีเฉพาะ')}`,
    `${reports ?? 0} ${t('รายงาน')}`,
    meta?.manual,
  ].filter(Boolean);
  return (
    <div className="py-10 text-center">
      {meta?.title && <h3 className="text-lg font-bold text-slate-800">{meta.title}</h3>}
      {meta?.subtitle && <p className="mt-0.5 text-sm text-slate-500">{meta.subtitle}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {stats.map((s, i) => <span key={i}>{s}</span>)}
      </div>
      <p className="mt-5 text-sm text-slate-500">{t('เลือกกรณีเฉพาะทางซ้ายเพื่อดูรายละเอียด')}</p>
    </div>
  );
}

/** กรณีเฉพาะ: รายการตรงกลาง รายละเอียดทางขวา และคอลัมน์เอกสารแนบขวาสุด */
export default function ScenariosView({
  modules, module, q = '', canEdit, onChanged, sharedNo, total, onClearModule, meta, reportCount,
}) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
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

  useEffect(() => { setList(null); const timer = setTimeout(load, q ? 250 : 0); return () => clearTimeout(timer); }, [load, q]);
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
      title: t('ลบกรณีเฉพาะ'),
      // ระบบจริงบอกผลที่ตามมาไว้ในกล่องยืนยันด้วย — ลบแล้วกรณีที่อยู่หลังจากนี้
      // ในหมวดเดียวกันจะเลื่อนหมายเลขขึ้นทั้งหมด ซึ่งเป็นเหตุผลที่คนลังเลจะกด
      message: `ลบกรณี ${s.display_no || ''} — "${s.title_th}" ใช่หรือไม่?\n\n`
        + 'ขั้นตอนทั้งหมดของกรณีนี้จะถูกลบด้วย และกรณีอื่นในหมวดเดียวกันที่อยู่หลังจากนี้'
        + 'จะเลื่อนหมายเลขขึ้นทั้งหมด (กู้คืนได้จากประวัติเวอร์ชัน)',
      confirmLabel: t('ลบ'), danger: true,
    });
    if (!ok) return false;
    try {
      await sopApi.deleteScenario(s.no);
      toast.success(t('ลบกรณีเฉพาะแล้ว'));
      if (openNo === s.no) setOpenNo(null);
      load(); onChanged?.();
      return true;
    } catch (e) { toast.error(e.message); return false; }
  };

  const move = async (s, direction) => {
    try {
      const r = await sopApi.moveScenario(s.no, direction);
      if (r.data?.moved === false) { toast.error(t('อยู่ตำแหน่งสุดขอบแล้ว')); return; }
      load(); setRev((n) => n + 1); // display_no shifts with the new order
    } catch (e) { toast.error(e.message); }
  };

  const modName = modules.find((m) => m.code === module);
  const heading = module ? `${module} · ${modName?.name_th_short || ''}` : t('ทั้งหมด');

  if (err) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {err}<button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!list) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลดกรณีเฉพาะ…')} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">
          {heading} · <span className="font-normal text-slate-500">{t('แสดง {n} จาก {total} กรณี', { n: list.length, total: total ?? list.length })}</span>
        </p>
        {canEdit && (
          <button onClick={() => setEdit(null)} className="btn-primary !py-1.5 !text-sm">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มกรณีใหม่')}
          </button>
        )}
      </div>

      {/* รายการว่างไม่ทำให้แถบรายละเอียดหายไป — ระบบจริงยังขึ้นหัวหมวดและหน้าต้อนรับ
          ไว้ข้าง ๆ ข้อความว่าไม่มีรายการ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        {/* รายการกรณี — บนจอมือถือสองแถบสลับกัน ไม่ซ้อนกัน กรณีที่เปิดอยู่จะได้
            ไม่จมอยู่ใต้รายการ 30 แถว */}
        <div className={`max-h-[74vh] space-y-2 overflow-y-auto pr-1 ${openNo != null ? 'hidden xl:block' : ''}`}>
          <ModuleHero mod={modName} lang={lang} />
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
              {/* ค้นไม่เจอ กับ หมวดนี้ยังไม่มีอะไร เป็นสองเรื่อง — ระบบจริงก็แยกข้อความ */}
              {q || !module ? t('ไม่พบรายการที่ค้นหา') : t('ยังไม่มีกรณีเฉพาะในหมวดนี้ · No scenarios in this module yet')}
            </p>
          ) : list.map((s) => {
            const name = titlePair(lang, s.title_th, s.title_en);
            return (
              <button key={s.no} onClick={() => setOpenNo(s.no)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  openNo === s.no ? 'border-navy ring-1 ring-navy/30' : 'border-slate-200 hover:border-slate-300'
                } bg-white`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`chip shrink-0 font-semibold ${toneOf(s.module)}`}>{s.display_no}</span>
                  {s.extra_modules?.length > 0 && (
                    <span className="flex flex-wrap justify-end gap-1">
                      {s.extra_modules.map((m) => (
                        <span key={m} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{m}</span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-sm font-bold leading-snug text-slate-800">{name.primary}</div>
                {s.problem && <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{s.problem}</div>}
              </button>
            );
          })}
        </div>

        {/* รายละเอียด + คอลัมน์เอกสารที่เกี่ยวข้อง */}
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${openNo == null ? 'hidden xl:block' : ''}`}>
          {/* On a phone the detail fills the screen and its title row scrolls
              away, taking แชร์/แก้ไข with it. Keep them on the back bar, which
              stays put — the same place the reader already looks to get out. */}
          {openNo != null && (
            <div style={{ top: barTop }} className="sticky z-10 -mx-5 mb-3 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2 xl:hidden">
              {/* บนจอมือถือมีสองทางออก เหมือนระบบจริง: กลับไปรายการกรณีในหมวดนี้
                  หรือถอยออกไปเลือกหมวดใหม่ทั้งชุด */}
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setOpenNo(null)} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                  <Icon name="arrowLeft" className="h-4 w-4" /> {t('รายการ · List')}
                </button>
                {module && onClearModule && (
                  <button onClick={() => { setOpenNo(null); onClearModule(); }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-500">
                    <Icon name="layers" className="h-4 w-4" /> {t('หมวด · Modules')}
                  </button>
                )}
              </div>
              {detail && (
                <div className="flex shrink-0 items-center gap-1">
                  <ShareButton param="case" value={detail.no} />
                  {canEdit && (
                    <button onClick={() => setEdit(detail)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-brand">
                      {t('แก้ไข · Edit')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {openNo == null ? (
            <WelcomePanel meta={meta} total={total} reports={reportCount} />
          ) : !detail ? (
            <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>
          ) : (
            <div className="flex flex-col gap-5 xl:flex-row">
              <article className="min-w-0 flex-1 space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${toneOf(detail.module)}`}>
                      {detail.display_no}
                    </span>
                    <div className="min-w-0">
                      {(() => {
                        const name = titlePair(lang, detail.title_th, detail.title_en);
                        return (
                          <>
                            <h3 className="text-lg font-bold leading-snug text-slate-800">{name.primary}</h3>
                            {name.secondary && <p className="text-sm text-slate-500">{name.secondary}</p>}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-wrap items-center gap-1 xl:flex">
                    <ShareButton param="case" value={detail.no} />
                    {canEdit && (
                      <>
                        <button onClick={() => move(detail, 'up')} title={t('เลื่อนขึ้น')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                          <Icon name="arrowLeft" className="h-4 w-4 rotate-90" />
                        </button>
                        <button onClick={() => move(detail, 'down')} title={t('เลื่อนลง')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                          <Icon name="arrowRight" className="h-4 w-4 rotate-90" />
                        </button>
                        <button onClick={() => setEdit(detail)} className="text-sm font-medium text-brand hover:underline">{t('แก้ไข · Edit')}</button>
                        <button onClick={() => remove(detail)} className="ml-2 text-sm text-rose-500 hover:underline">{t('ลบ · Delete')}</button>
                      </>
                    )}
                  </div>
                </header>

                {detail.problem && (
                  <section>
                    {/* uppercase คือหน้าตาของเขาเอง — ป้ายขึ้นเป็น "· PROBLEM" */}
                    <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">{t('ปัญหา / สถานการณ์ · Problem')}</h4>
                    <p className="whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">{detail.problem}</p>
                  </section>
                )}

                {detail.steps?.length > 0 && (
                  <section>
                    <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('แนวทางปฏิบัติ · Solution (SOP)')}</h4>
                    {/* สี่ระดับเหมือนคู่มือของระบบจริง: ลำดับ · จุด · ย่อย · ย่อยชั้นสอง */}
                    <ol className="space-y-2">
                      {detail.steps.map((st, i) => {
                        const style = st.style || (st.is_substep ? 'sub' : 'num');
                        const n = detail.steps.slice(0, i + 1).filter((x) => (x.style || (x.is_substep ? 'sub' : 'num')) === 'num').length;
                        return <Step key={i} style={style} n={n} text={st.text} />;
                      })}
                    </ol>
                  </section>
                )}

                {detail.note && (
                  <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><b>{t('หมายเหตุ:')}</b> {detail.note}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {detail.ref && <span>{t('อ้างอิง (Reference)')}: {detail.ref}</span>}
                  {detail.date_added && <span>{t('วันที่เพิ่ม:')} {detail.date_added}</span>}
                  <span>{t('หมวด (Module)')}: {[detail.module, ...(detail.extra_modules || [])].join(' · ')}</span>
                </div>
              </article>

              {/* ไฟล์ SOP ฉบับเต็มของกรณีนี้ — ระบบจริงวางเป็นคอลัมน์แคบขวาสุด */}
              <AttachmentRail items={detail.attachments || []} />
            </div>
          )}
        </div>
      </div>

      {edit !== undefined && (
        <ScenarioModal item={edit} modules={modules}
          onClose={() => setEdit(undefined)}
          /* ลบจากในหน้าต่างแก้ไขแบบระบบจริง — บนจอมือถือแถบบนมีแค่ แชร์/แก้ไข
             ผู้แก้ไขที่ใช้โทรศัพท์จึงไม่มีทางลบกรณีได้เลยก่อนหน้านี้ */
          onDelete={edit ? async () => { if (await remove(edit)) setEdit(undefined); } : undefined}
          onSwapped={() => { setEdit(undefined); load(); onChanged?.(); setRev((n) => n + 1); }}
          onSaved={(no) => {
            setEdit(undefined); load(); onChanged?.();
            if (no) setOpenNo(no);        // a new case opens straight away
            else setRev((n) => n + 1);    // an edited one refetches in place
          }} />
      )}
    </div>
  );
}
