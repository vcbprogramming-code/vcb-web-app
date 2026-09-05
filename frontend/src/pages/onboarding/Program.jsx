import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { programApi, randomReward } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import Documents from './Documents.jsx';
import Phase from './Phase.jsx';
import Completion from './Completion.jsx';
import Cohort from './Cohort.jsx';

/**
 * ปฐมนิเทศพนักงานใหม่ 90 วัน
 *
 * เดินตามลำดับ: ส่งเอกสาร → เลือกแผนก → สามเฟส → หน้าจบโปรแกรม
 * เฟสที่ยังไม่ปลดล็อก "อ่านได้" เสมอ ล็อกเฉพาะการติ๊ก — คนที่อยากเตรียมตัว
 * ล่วงหน้าต้องอ่านได้ ไม่ใช่เจอหน้าว่าง
 */
export default function Program() {
  const t = useT();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  const [reward, setReward] = useState(null);
  const rewardTimer = useRef(null);

  const view = sp.get('v') || 'docs';
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

  const { departments, documents, status, isAdmin } = boot;
  const dept = departments.find((d) => d.slug === status.department) || null;

  const tabs = [
    { key: 'docs', label: t('เอกสารที่ต้องส่ง'), done: status.docsComplete },
    ...(dept ? dept.phases.map((p, i) => ({
      key: p.id,
      label: t('วันที่ {r}', { r: p.day_range }),
      done: status.phases[i]?.complete,
      locked: !status.unlocked[p.id],
    })) : []),
    ...(status.allComplete ? [{ key: 'done', label: t('จบโปรแกรม'), done: true }] : []),
    ...(isAdmin ? [{ key: 'cohort', label: t('ภาพรวมพนักงาน') }] : []),
  ];

  const total = status.phases.reduce((a, p) => a + p.total, 0);
  const done = status.phases.reduce((a, p) => a + p.done, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ปฐมนิเทศพนักงานใหม่')}
        subtitle={t('โปรแกรม 90 วัน — เอกสาร แผนกที่สังกัด และรายการที่ต้องทำในแต่ละช่วง')}
        right={dept && total > 0 ? (
          <div className="text-right">
            <div className="text-xs text-slate-500">{t('ความคืบหน้ารวม')}</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{done}/{total}</div>
          </div>
        ) : undefined}
      />

      {/* เลือกแผนก — ทำได้ตลอด เปลี่ยนแล้วความคืบหน้าของแผนกเดิมไม่หาย */}
      <div className="card-sm flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">{t('แผนกที่สังกัด')}</span>
        {departments.map((d) => (
          <button key={d.slug}
            onClick={async () => {
              try { await programApi.setMe({ department: d.slug }); await load(); setView('docs'); }
              catch (e) { toast.error(e.message); }
            }}
            className={`chip ${status.department === d.slug ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {d.name_th || d.name}
          </button>
        ))}
        {dept && (
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            {t('ระดับพนักงาน')}
            <select value={status.track}
              onChange={async (e) => {
                try { await programApi.setMe({ track: e.target.value }); await load(); }
                catch (err) { toast.error(err.message); }
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand">
              <option value="junior">{t('ระดับต้น')}</option>
              <option value="senior">{t('ระดับอาวุโส')}</option>
            </select>
          </label>
        )}
      </div>

      {!dept ? (
        <div className="card py-12 text-center">
          <h3 className="font-bold text-slate-700">{t('เลือกแผนกที่จะไปประจำก่อน')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('รายการที่ต้องทำใน 90 วันแรกต่างกันไปตามแผนก')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  view === tab.key ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {tab.done && <Icon name="check" className="h-3.5 w-3.5" />}
                {tab.locked && <Icon name="lock" className="h-3.5 w-3.5 opacity-60" />}
                {tab.label}
              </button>
            ))}
          </div>

          {view === 'docs' && <Documents documents={documents} status={status} onChanged={load} />}
          {view === 'cohort' && isAdmin && <Cohort />}
          {view === 'done' && <Completion dept={dept} status={status} />}
          {dept.phases.filter((p) => p.id === view).map((p) => (
            <Phase key={p.id} phase={p} status={status} isAdmin={isAdmin}
              onChanged={load} onReward={flashReward}
              onNext={() => setView(p.next_phase || (status.allComplete ? 'done' : p.id))} />
          ))}
        </>
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
