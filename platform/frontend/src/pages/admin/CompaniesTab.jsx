import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const EMPTY = { name: '', nameEn: '', address: '', phone: '', fax: '', telex: '', logoUrl: '', isDefault: false };

/** A small logo preview that fetches the (auth-gated) image as a blob URL. */
function LogoThumb({ companyId, logoUrl, size = 44 }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    if (companyId && logoUrl) {
      adminApi.companyLogoBlobUrl(companyId).then((u) => { url = u; setSrc(u); }).catch(() => setSrc(null));
    } else {
      setSrc(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [companyId, logoUrl]);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white"
      style={{ width: size, height: size }}
    >
      {src
        ? <img src={src} alt="" className="h-full w-full object-contain" />
        : <Icon name="building" className="h-5 w-5 text-slate-300" />}
    </span>
  );
}

export default function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null); // 'new' | uuid | null
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localLogo, setLocalLogo] = useState(null); // preview for a freshly-picked logo

  const load = () => adminApi.listCompanies().then((r) => setCompanies(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditId('new'); setForm(EMPTY); setLocalLogo(null); setError(null); };
  const startEdit = (c) => {
    setEditId(c.id);
    setForm({
      name: c.name || '', nameEn: c.name_en || '', address: c.address || '',
      phone: c.phone || '', fax: c.fax || '', telex: c.telex || '',
      logoUrl: c.logo_url || '', isDefault: !!c.is_default,
    });
    setLocalLogo(null);
    setError(null);
  };
  const cancel = () => { setEditId(null); setForm(EMPTY); setLocalLogo(null); };

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { data } = await adminApi.uploadCompanyLogo(file);
      setForm((f) => ({ ...f, logoUrl: data.key }));
      setLocalLogo(URL.createObjectURL(file));
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('กรุณากรอกชื่อบริษัท'); return; }
    setBusy(true);
    setError(null);
    const body = {
      name: form.name.trim(), nameEn: form.nameEn.trim() || null, address: form.address.trim() || null,
      phone: form.phone.trim() || null, fax: form.fax.trim() || null, telex: form.telex.trim() || null,
      logoUrl: form.logoUrl || null, isDefault: form.isDefault,
    };
    try {
      if (editId === 'new') await adminApi.createCompany(body);
      else await adminApi.updateCompany(editId, body);
      cancel();
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const makeDefault = async (id) => {
    try { await adminApi.updateCompany(id, { isDefault: true }); load(); }
    catch (err) { setError(err.message); }
  };

  const remove = async (c) => {
    if (!window.confirm(`ลบบริษัท "${c.name}" ?`)) return;
    try { await adminApi.deleteCompany(c.id); load(); }
    catch (err) { setError(err.message); }
  };

  const field = 'field';
  const editing = editId !== null;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          บริษัท/ตราสำหรับหัวจดหมาย — ผู้สร้างเอกสารจะเลือกได้ตอนสร้างบันทึกข้อความ โลโก้และหัวจดหมายจะเปลี่ยนตามบริษัทที่เลือก
        </p>
        {!editing && (
          <button onClick={startNew} className="btn-primary shrink-0">
            <Icon name="plus" className="mr-1 inline h-4 w-4 align-[-2px]" /> เพิ่มบริษัท
          </button>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {editing && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {localLogo
                  ? <img src={localLogo} alt="" className="h-full w-full object-contain" />
                  : (editId !== 'new' && form.logoUrl
                    ? <LogoThumb companyId={editId} logoUrl={form.logoUrl} size={80} />
                    : <Icon name="building" className="h-8 w-8 text-slate-300" />)}
              </span>
              <label className="cursor-pointer text-xs font-medium text-brand hover:underline">
                {uploading ? 'กำลังอัปโหลด…' : 'เลือกโลโก้'}
                <input type="file" accept="image/*" className="hidden" onChange={pickLogo} disabled={uploading} />
              </label>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">ชื่อบริษัท (ไทย) *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} w-full`} placeholder="บริษัท ... จำกัด" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">ชื่อบริษัท (อังกฤษ)</span>
                <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={`${field} w-full`} placeholder="... Co., Ltd." />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">ที่อยู่</span>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${field} w-full`} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">โทรศัพท์</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${field} w-full`} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">โทรสาร</span>
                <input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} className={`${field} w-full`} />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            ตั้งเป็นบริษัทหลัก (ค่าเริ่มต้นเมื่อสร้างเอกสาร)
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={cancel} className="btn-outline">ยกเลิก</button>
            <button type="submit" disabled={busy || uploading} className="btn-primary">
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {companies.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">ยังไม่มีบริษัท</p>
        ) : companies.map((c) => (
          <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
            <LogoThumb companyId={c.id} logoUrl={c.logo_url} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-800">{c.name}</span>
                {c.is_default && (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">ค่าเริ่มต้น</span>
                )}
              </div>
              {c.name_en && <div className="truncate text-xs text-slate-400">{c.name_en}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {!c.is_default && (
                <button onClick={() => makeDefault(c.id)} className="text-slate-500 hover:text-brand hover:underline">ตั้งเป็นค่าเริ่มต้น</button>
              )}
              <button onClick={() => startEdit(c)} className="text-blue-600 hover:underline">แก้ไข</button>
              {!c.is_default && (
                <button onClick={() => remove(c)} className="text-red-500 hover:underline">ลบ</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
