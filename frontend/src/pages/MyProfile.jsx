import { useEffect, useState } from 'react';
import { profileApi, ROLE_LABELS } from '../lib/ememo.js';
import Icon from '../components/Icon.jsx';
import { PageHeader } from '../components/ui/index.js';

/**
 * "โปรไฟล์ของฉัน" — each user sets their display name, job title and a default
 * signature. New memos use these automatically (title under the name, signature
 * image above it).
 */
export default function MyProfile() {

  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [sigUrl, setSigUrl] = useState(null);   // shown signature (blob url)
  const [sigFile, setSigFile] = useState(null);  // newly picked file
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    profileApi.me().then((r) => {
      setProfile(r.profile);
      setFullName(r.profile.full_name || '');
      setJobTitle(r.profile.job_title || '');
      if (r.profile.signature_url) {
        profileApi.signatureBlobUrl().then(setSigUrl).catch(() => {});
      }
    }).catch((e) => setError(e.message));
  }, []);

  // revoke the signature blob URL when it's replaced or on unmount (prevents a leak)
  useEffect(() => () => { if (sigUrl?.startsWith('blob:')) URL.revokeObjectURL(sigUrl); }, [sigUrl]);

  const pickSig = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('ลายเซ็นต้องเป็นรูปภาพ'); return; }
    if (f.size > 2 * 1024 * 1024) { setError('รูปลายเซ็นใหญ่เกิน 2 MB'); return; }
    setError(null);
    setSigFile(f);
    setSigUrl((old) => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let signatureUrl;
      if (sigFile) {
        const { data } = await profileApi.uploadSignature(sigFile);
        signatureUrl = data.key;
      }
      await profileApi.update({
        fullName: fullName.trim() || undefined,
        jobTitle: jobTitle.trim() || null,
        ...(signatureUrl ? { signatureUrl } : {}),
      });
      setSaved(true);
      setSigFile(null);

    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const removeSig = async () => {
    setBusy(true);
    try {
      await profileApi.update({ signatureUrl: null });
      setSigUrl((old) => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return null; });
      setSigFile(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!profile) return <div className="text-slate-400">กำลังโหลด…</div>;
  const field = 'field';

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="โปรไฟล์ของฉัน" subtitle="ตั้งค่าชื่อ ตำแหน่ง และลายเซ็นที่จะแสดงในเอกสาร" />

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อ-นามสกุล</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">อีเมล</label>
            <input value={profile.email || ''} disabled className={`${field} bg-slate-100 text-slate-500`} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">บทบาท</label>
            <input value={ROLE_LABELS[profile.role] || profile.role} disabled className={`${field} bg-slate-100 text-slate-500`} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ตำแหน่ง (แสดงใต้ชื่อในเอกสาร)</label>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="เช่น ผู้จัดการฝ่ายวิศวกรรม" className={field} />
        </div>

        {/* signature */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ลายเซ็น (ไม่บังคับ)</label>
          <p className="mb-2 text-xs text-slate-400">อัปโหลดรูปลายเซ็น — จะแสดงเหนือชื่อในหนังสือโดยอัตโนมัติ (PNG พื้นโปร่งใสจะดูดีที่สุด)</p>
          {sigUrl ? (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
              <img src={sigUrl} alt="ลายเซ็น" className="h-16 w-auto object-contain" />
              <div className="flex gap-3">
                <label className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">
                  เปลี่ยนรูป
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickSig(e.target.files?.[0])} />
                </label>
                <button onClick={removeSig} disabled={busy} className="text-sm text-red-500 hover:underline">ลบลายเซ็น</button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-6 hover:border-slate-300">
              <Icon name="signature" className="h-6 w-6 text-slate-400" />
              <span className="text-sm text-slate-600">คลิกเพื่ออัปโหลดรูปลายเซ็น</span>
              <span className="text-xs text-slate-400">PNG/JPG · สูงสุด 2 MB</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickSig(e.target.files?.[0])} />
            </label>
          )}
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {saved && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">บันทึกโปรไฟล์เรียบร้อยแล้ว</div>}

        <div className="flex justify-end">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}
