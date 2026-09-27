import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { programApi, randomReward, pick } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader, Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';
import Documents from './Documents.jsx';
import Preboarding from './Preboarding.jsx';
import Phase from './Phase.jsx';
import Completion from './Completion.jsx';
import Cohort from './Cohort.jsx';
import ChecklistAdmin from './ChecklistAdmin.jsx';

/**
 * ปฐมนิเทศพนักงานใหม่ 90 วัน
 *
 * ลำดับเดียวกับพอร์ทัลที่บริษัทใช้อยู่ — เจ็ดขั้นในชั้นวางด้านซ้าย:
 *   เตรียมความพร้อมก่อนเริ่มงาน → เอกสารที่จำเป็น → เลือกแผนก
 *   → วันที่ 1–30 → วันที่ 31–60 → วันที่ 61–90 → สำเร็จการปฐมนิเทศ
 *
 * สามขั้นแรกเปิดได้ก่อนเลือกแผนก และ **ต้องเปิดได้** — ประตูกั้นของเขาคือเอกสาร
 * ที่จำเป็นต้องครบก่อนจึงเลือกแผนกได้ ถ้าหน้าเอกสารเปิดได้เฉพาะคนที่เลือกแผนก
 * แล้ว พนักงานใหม่จะติดอยู่ตรงนั้นโดยไม่มีทางออกเลย
 *
 * เฟสที่ยังไม่ปลดล็อก "อ่านได้" เสมอ ล็อกเฉพาะการติ๊ก — คนที่อยากเตรียมตัว
 * ล่วงหน้าต้องอ่านได้ ไม่ใช่เจอหน้าว่าง
 */
const DAY_LABEL = { '1-30': 'วันที่ 1–30', '31-60': 'วันที่ 31–60', '61-90': 'วันที่ 61–90' };
/** ชื่อย่อของสามบล็อกในชั้นวาง (ของเขาย่อเหลือ Reading/Knowledge/Outputs) */
const BLOCK_SHORT = ['เอกสารที่ต้องศึกษา', 'ความรู้ที่จำเป็น', 'ผลงานที่ต้องส่งมอบ'];

export default function Program() {
  // แยกสองบรรทัด ไม่ใช่ const { t, lang } = useLang() — กติกาของ i18n:check คือ
  // ทุกฟังก์ชันที่เรียก t() ต้องถือ useT() ไว้เอง จะได้ไม่มี t ตัวอื่นมาบัง
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  const [reward, setReward] = useState(null);
  const [gate, setGate] = useState(null);      // แผนกที่กดไว้ตอนเอกสารยังไม่ครบ
  const rewardTimer = useRef(null);

  const view = sp.get('v') || 'welcome';
  const setView = (v) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('v', v); return n; }, { replace: true });

  const load = useCallback(() => programApi.bootstrap()
    .then((r) => setBoot(r.data))
    .catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimeout(rewardTimer.current), []);

  const flashReward = () => {
    setReward(randomReward());
    clearTimeout(rewardTimer.current);
    rewardTimer.current = setTimeout(() => setReward(null), 2200);
  };

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!boot) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const { departments, documents, status, isAdmin, me } = boot;
  const dept = departments.find((d) => d.slug === status.department) || null;
  const deptName = dept ? (dept.name_th || dept.name) : null;

  const total = status.phases.reduce((a, p) => a + p.total, 0);
  const done = status.phases.reduce((a, p) => a + p.done, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  /** ติ๊กไปแล้วกี่ข้อในบล็อกหนึ่ง โดยนับเฉพาะข้อที่ระดับของคนนี้มองเห็น */
  const blockDone = (block) => {
    const items = block.items.filter((i) => i.level === 'junior' || status.track === 'senior');
    return { done: items.filter((i) => status.done.includes(i.id)).length, total: items.length };
  };

  // ── ชั้นวางเจ็ดขั้น ───────────────────────────────────────────────────────
  const steps = [
    { key: 'welcome', label: t('เตรียมความพร้อมก่อนเริ่มงาน') },
    { key: 'docs', label: t('เอกสารที่จำเป็น'), done: status.docsComplete },
    { key: 'dept', label: t('เลือกแผนก'), done: Boolean(dept) },
    ...(dept ? dept.phases.map((p, i) => ({
      key: p.id,
      label: t(DAY_LABEL[p.day_range] || `วันที่ ${p.day_range}`),
      done: status.phases[i]?.complete,
      locked: !status.unlocked[p.id],
      subs: p.blocks.map((b, bi) => {
        const c = blockDone(b);
        return { label: pick(lang, b.heading, b.heading_th) || t(BLOCK_SHORT[bi] || ''), done: c.total > 0 && c.done === c.total };
      }),
    })) : []),
    { key: 'done', label: t('สำเร็จการปฐมนิเทศ'), done: status.allComplete },
    ...(isAdmin ? [
      { key: 'cohort', label: t('ภาพรวมพนักงาน') },
      { key: 'editor', label: t('แก้เช็กลิสต์') },
    ] : []),
  ];

  /** เลือกแผนก — เอกสารยังไม่ครบก็ยังเลือกไม่ได้ ตามประตูกั้นของเขา */
  const chooseDept = async (slug) => {
    if (!status.docsComplete) { setGate(slug); return; }
    try {
      await programApi.setMe({ department: slug });
      const fresh = await programApi.bootstrap();
      setBoot(fresh.data);
      const d = fresh.data.departments.find((x) => x.slug === slug);
      setView(d?.phases?.[0]?.id || 'dept');
    } catch (e) { toast.error(e.message); }
  };

  const missingTitles = (status.missingDocuments || [])
    .map((id) => documents.find((d) => d.id === id))
    .filter(Boolean)
    .map((d) => pick(lang, d.title, d.title_th));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ปฐมนิเทศพนักงานใหม่')}
        subtitle={t('โปรแกรม 90 วัน — เอกสารที่จำเป็น แผนกของคุณ และงานที่ต้องทำในแต่ละระยะ')}
        right={dept && total > 0 ? (
          <div className="text-right">
            <div className="text-xs text-slate-500">{t('ความคืบหน้ารวม')}</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{pct}%</div>
          </div>
        ) : undefined}
      />

      {/* แถบความคืบหน้า — อยู่ทุกหน้า ไม่ใช่เฉพาะหน้าเฟส ตามพอร์ทัลของเขา */}
      <div className="card-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-slate-700">
            {t('ความคืบหน้าการปฐมนิเทศของคุณ')}
            {me?.name ? ` — ${me.name}` : ''}
            {deptName ? ` (${deptName})` : ''}
          </div>
          <div className="text-sm tabular-nums text-slate-500">{pct}% {t('เสร็จสมบูรณ์')}</div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${status.allComplete ? 'bg-emerald-500' : 'bg-brand'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-slate-500">
          {dept
            ? <><span className="tabular-nums font-semibold text-slate-600">{done}/{total}</span> {t('งานที่เสร็จสมบูรณ์ในแผนกของคุณ')}</>
            : t('ทำการเตรียมความพร้อมก่อนเริ่มงานให้เสร็จและเลือกแผนกเพื่อเริ่มติดตามความคืบหน้าการปฐมนิเทศของคุณที่นี่')}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ชั้นวางเจ็ดขั้น — แนวตั้งแบบของเขา มีบรรทัดย่อยสามบล็อกใต้แต่ละเฟส */}
        <nav aria-label={t('ขั้นตอนการปฐมนิเทศ')} className="card-sm self-start lg:sticky lg:top-4">
          <ol className="space-y-0.5">
            {steps.map((s) => (
              <li key={s.key}>
                <button onClick={() => setView(s.key)}
                  aria-current={view === s.key ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${
                    view === s.key ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    s.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : view === s.key ? 'border-white/60 text-white' : 'border-slate-300 text-slate-400'}`}>
                    {s.done ? <Icon name="check" className="h-3 w-3" />
                      : s.locked ? <Icon name="lock" className="h-2.5 w-2.5" /> : ''}
                  </span>
                  <span className="min-w-0 flex-1">{s.label}</span>
                </button>
                {s.subs && (
                  <ul className="mb-1 ml-8 space-y-0.5 border-l border-slate-200 pl-2.5">
                    {s.subs.map((sub) => (
                      <li key={sub.label} className="flex items-center gap-1.5 py-0.5 text-xs text-slate-500">
                        <Icon name="check" className={`h-3 w-3 shrink-0 ${sub.done ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span className="truncate">{sub.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {view === 'welcome' && <Preboarding onStart={() => setView('docs')} />}
          {view === 'docs' && <Documents documents={documents} status={status} onChanged={load}
            onDone={() => setView('dept')} />}
          {view === 'dept' && (
            <DepartmentPicker departments={departments} status={status} lang={lang}
              onPick={chooseDept}
              onTrack={async (v) => {
                try { await programApi.setMe({ track: v }); await load(); }
                catch (e) { toast.error(e.message); }
              }} />
          )}
          {view === 'cohort' && isAdmin && <Cohort />}
          {view === 'editor' && isAdmin && <ChecklistAdmin departments={departments} onChanged={load} />}
          {view === 'done' && <Completion dept={dept} status={status} me={me} lang={lang} />}
          {dept && dept.phases.filter((p) => p.id === view).map((p) => (
            <Phase key={p.id} phase={p} status={status} lang={lang}
              onChanged={load} onReward={flashReward}
              onNext={() => setView(p.next_phase || (status.allComplete ? 'done' : p.id))} />
          ))}
          {/* ขอ view ของเฟสมาแต่ยังไม่ได้เลือกแผนก (ลิงก์เก่า / พิมพ์ URL เอง) */}
          {!dept && !['welcome', 'docs', 'dept', 'cohort', 'editor', 'done'].includes(view) && (
            <div className="card py-12 text-center">
              <h3 className="font-bold text-slate-700">{t('เลือกแผนกที่จะไปประจำก่อน')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('รายการที่ต้องทำใน 90 วันแรกต่างกันไปตามแผนก')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ประตูกั้น — กดเลือกแผนกตอนเอกสารยังไม่ครบ ต้องเห็นว่าขาดฉบับไหน */}
      {gate && (
        <Modal title={t('กรุณากรอกเอกสารที่จำเป็นให้ครบก่อน')} onClose={() => setGate(null)} size="md"
          footer={(
            <>
              <button onClick={() => setGate(null)} className="btn-outline">{t('ปิด')}</button>
              <button onClick={() => { setGate(null); setView('docs'); }} className="btn-primary">
                {t('ไปที่เอกสารที่จำเป็น')}
              </button>
            </>
          )}>
          <p className="text-sm text-slate-600">
            {t('การเลือกแผนกจะถูกล็อกไว้จนกว่าเอกสารที่จำเป็นทุกฉบับจะถูกทำเครื่องหมายว่าเสร็จสมบูรณ์ เอกสารที่ยังขาดอยู่:')}
          </p>
          <ul className="space-y-1">
            {missingTitles.map((title) => (
              <li key={title} className="flex items-start gap-2 text-sm text-slate-700">
                <Icon name="warning" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {title}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {/* ข้อความให้กำลังใจ ลอยขึ้นมาแล้วหายเอง */}
      {reward && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {reward}
        </div>
      )}
    </div>
  );
}

/**
 * เลือกแผนก — ขั้นที่เขาเรียกว่า "ขั้นตอนที่สำคัญที่สุดในการเตรียมความพร้อม"
 *
 * ต่างจากของเขาข้อเดียว และเป็นข้อที่ต้องให้เจ้าของงานตัดสิน: ของเขาเปลี่ยนแผนก
 * แล้ว **ลบ** ความคืบหน้าของแผนกเดิมทิ้ง ของเราเก็บไว้ กดผิดครั้งเดียวไม่ควร
 * ทำลายงานหลายสัปดาห์ คำโปรยท้ายการ์ดจึงเขียนตามพฤติกรรมจริงของเรา
 */
function DepartmentPicker({ departments, status, lang, onPick, onTrack }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="card space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          {t('ขั้นตอนที่สำคัญที่สุดในการเตรียมความพร้อมก่อนเริ่มงาน')}
        </p>
        <h2 className="text-xl font-bold text-slate-800">{t('เลือกแผนก')}</h2>
        <p className="text-sm text-slate-600">
          {t('เลือกแผนกที่คุณจะใช้เวลา 90 วันแรกด้วยกัน แผนกนี้เป็นตัวกำหนดรายการตรวจสอบ เป้าหมาย และผู้คนที่คุณจะทำงานร่วมกันตั้งแต่นี้ไป')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {departments.map((d, i) => {
          const on = status.department === d.slug;
          return (
            <button key={d.slug} onClick={() => onPick(d.slug)}
              className={`card flex items-start gap-3 text-left transition hover:border-brand/40 ${
                on ? 'ring-2 ring-brand' : ''}`}>
              <span className="text-lg font-bold tabular-nums text-slate-300">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800">{lang === 'en' ? d.name : (d.name_th || d.name)}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {t('ครบทั้งสามระยะของการปฐมนิเทศทำในแผนกนี้')}
                </span>
              </span>
              {on
                ? <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-500" />
                : <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300" />}
            </button>
          );
        })}
      </div>

      <div className="card space-y-2">
        <h3 className="font-bold text-slate-800">{t('เลือกระดับตำแหน่งของคุณ')}</h3>
        <p className="text-sm text-slate-500">
          {t('งานระดับจูเนียร์ครอบคลุมพื้นฐานหลัก ระดับซีเนียร์จะมีงานเพิ่มเติม ซึ่งระบุด้วยสีเหลืองอำพัน')}
        </p>
        <div className="flex gap-2">
          {[['junior', 'จูเนียร์'], ['senior', 'ซีเนียร์']].map(([value, label]) => (
            <button key={value} onClick={() => onTrack(value)}
              className={`chip ${status.track === value ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t(label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
