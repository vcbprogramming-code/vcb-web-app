import { useEffect, useState } from 'react';
import { adminApi, ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const COLORS = ['#2563eb', '#db2777', '#9333ea', '#0891b2', '#65a30d', '#7c3aed', '#16a34a', '#ea580c', '#dc2626', '#0d9488'];

// blank letterhead form (company name per project lives here now — the standalone
// "หัวจดหมาย" tab was removed; this is the single place to edit it)
const emptyLetter = {
  companyName: '', companyNameEn: '', address: '', phone: '', telex: '', fax: '',
  companyId: '', signatureUrl: '', managerEmail: '',
  signatoryName: '', signatoryTitle: '', closingLine: '', defaultRecipient: '',
};

function ProjectModal({ project, onClose, onSaved }) {
  const editing = Boolean(project);
  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [docPrefix, setDocPrefix] = useState(project?.doc_prefix || '');
  const [color, setColor] = useState(project?.color || COLORS[0]);
  const [letter, setLetter] = useState(emptyLetter);
  const setL = (k, v) => setLetter((f) => ({ ...f, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]); // system accounts, for the manager picker (#3)
  const [sigUploading, setSigUploading] = useState(false);
  const [sigPreview, setSigPreview] = useState(null); // object URL of the current signature

  // list of บริษัท/ตรา to bind this project to (#4) + system accounts for the
  // project-manager (approver) picker (#3)
  useEffect(() => {
    adminApi.listCompanies().then((r) => setCompanies(r.data || [])).catch(() => setCompanies([]));
    ememoApi.listApprovers().then((r) => setUsers(r.data || [])).catch(() => setUsers([]));
  }, []);

  // when editing an existing project, load its per-project letterhead config
  useEffect(() => {
    if (!editing) return;
    adminApi.getLetterhead(project.id).then((r) => {
      const d = r.data || {};
      setLetter({
        companyName: d.company_name || '', companyNameEn: d.company_name_en || '',
        address: d.address || '', phone: d.phone || '', telex: d.telex || '', fax: d.fax || '',
        companyId: d.company_id || '', signatureUrl: d.signature_url || '', managerEmail: d.manager_email || '',
        signatoryName: d.signatory_name || '', signatoryTitle: d.signatory_title || '',
        closingLine: d.closing_line || '', defaultRecipient: d.default_recipient || '',
      });
    }).catch(() => {});
  }, [editing, project?.id]);

  // upload a new signature image (#6) — store its key, save happens with the form
  const uploadSignature = async (file) => {
    if (!file) return;
    if (!editing) { setError('บันทึกโครงการก่อน จึงจะอัปโหลดลายเซ็นได้'); return; }
    setSigUploading(true); setError(null);
    try {
      const { data } = await adminApi.uploadProjectSignature(project.id, file);
      setL('signatureUrl', data.key);
      setSigPreview(URL.createObjectURL(file));
    } catch (e) { setError(e.message); }
    finally { setSigUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { code, name, docPrefix, color };
      // create the project first if new (we need its id to save the letterhead)
      const projectId = editing
        ? (await adminApi.updateProject(project.id, body), project.id)
        : (await adminApi.createProject(body)).data.id;
      // save the per-project letterhead (company name etc.) alongside. Empty
      // company/signature selections must go as null (not '') so the UUID field
      // validates — otherwise the save 400s and a just-uploaded signature is lost.
      await adminApi.saveLetterhead(projectId, {
        ...letter,
        companyId: letter.companyId || null,
        signatureUrl: letter.signatureUrl || null,
        managerEmail: letter.managerEmail || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'field';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขโครงการ' : 'เพิ่มโครงการ'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">รหัสโครงการ <span className="text-red-500">*</span></label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น BT1" className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Prefix เลขเอกสาร <span className="text-red-500">*</span></label>
              <input value={docPrefix} onChange={(e) => setDocPrefix(e.target.value)} placeholder="เช่น BT" className={field} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อโครงการ <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">สีประจำโครงการ</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="mt-2 text-sm text-slate-500">ตัวอย่าง: <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: color }}>{code || 'CODE'}</span></div>
          </div>

          {/* ── หัวจดหมายของโครงการนี้ (per-project letterhead) ── */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-700">หัวจดหมายของโครงการนี้</h4>
            <p className="mb-3 text-xs text-slate-400">ชื่อบริษัท/หน่วยงานและข้อมูลนี้จะแสดงบนหนังสือของโครงการนี้ (แต่ละโครงการตั้งได้ต่างกัน)</p>
            <div className="space-y-3">
              {/* บริษัท/ตราหัวจดหมายเริ่มต้น — ล็อกตราของโครงการนี้ (#4) */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">หัวกระดาษเริ่มต้น (บริษัท / ตรา)</label>
                <select value={letter.companyId} onChange={(e) => setL('companyId', e.target.value)} className={field}>
                  <option value="">— ใช้ค่าเริ่มต้นของระบบ —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (ค่าเริ่มต้น)' : ''}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">เอกสารทุกใบของโครงการนี้จะใช้หัวกระดาษนี้โดยอัตโนมัติ (ผู้สร้างเอกสารเปลี่ยนตราไม่ได้)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อบริษัท / หน่วยงาน (ไทย)</label>
                <input value={letter.companyName} onChange={(e) => setL('companyName', e.target.value)} placeholder="เช่น กิจการร่วมค้า ซีวีอี" className={field} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อบริษัท (อังกฤษ)</label>
                <input value={letter.companyNameEn} onChange={(e) => setL('companyNameEn', e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">ที่อยู่</label>
                <textarea value={letter.address} onChange={(e) => setL('address', e.target.value)} rows={2} className={field} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">โทรศัพท์</label>
                  <input value={letter.phone} onChange={(e) => setL('phone', e.target.value)} className={field} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">เทเล็กซ์</label>
                  <input value={letter.telex} onChange={(e) => setL('telex', e.target.value)} className={field} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">โทรสาร</label>
                  <input value={letter.fax} onChange={(e) => setL('fax', e.target.value)} className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">ผู้จัดการโครงการ / ผู้ลงนาม</label>
                  <input value={letter.signatoryName} onChange={(e) => setL('signatoryName', e.target.value)} placeholder="ชื่อผู้จัดการโครงการ" className={field} />
                  <p className="mt-1 text-[11px] text-slate-400">ชื่อนี้จะไปอยู่ใต้ “ขอแสดงความนับถือ” ของทุกเอกสารในโครงการนี้</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">ตำแหน่งผู้ลงนาม</label>
                  <input value={letter.signatoryTitle} onChange={(e) => setL('signatoryTitle', e.target.value)} placeholder="เช่น ผู้จัดการโครงการ" className={field} />
                </div>
              </div>

              {/* ผู้จัดการโครงการ (บัญชีสำหรับอนุมัติ) — auto-route approval here (#3) */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <label className="block text-sm font-medium text-slate-600 mb-1">ผู้จัดการโครงการ (บัญชีสำหรับอนุมัติ)</label>
                <p className="mb-2 text-[11px] text-slate-400">เลือกบัญชีผู้ใช้ในระบบที่เป็นผู้จัดการโครงการ — เวลาสร้าง/ส่งอนุมัติเอกสารของโครงการนี้ ระบบจะส่งให้ท่านนี้อนุมัติโดยอัตโนมัติ (แก้เปลี่ยนได้ตอนส่ง)</p>
                <select
                  value={letter.managerEmail}
                  onChange={(e) => {
                    const email = e.target.value;
                    setL('managerEmail', email);
                    // if no printed signatory name yet, borrow the picked account's name
                    const u = users.find((x) => x.email === email);
                    if (u && !letter.signatoryName.trim()) setL('signatoryName', u.full_name || '');
                  }}
                  className={field}
                >
                  <option value="">— ยังไม่กำหนด (เลือกผู้อนุมัติเองตอนส่ง) —</option>
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>

              {/* ลายเซ็นของผู้ลงนาม — ประทับอัตโนมัติบนทุกเอกสารของโครงการ (#6) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <label className="block text-sm font-medium text-slate-600 mb-1">ลายเซ็นผู้ลงนาม (อัตโนมัติ)</label>
                <p className="mb-2 text-[11px] text-slate-400">อัปโหลดรูปลายเซ็น (พื้นหลังโปร่งใส .png จะสวยที่สุด) — ระบบจะประทับลายเซ็นนี้ใต้ “ขอแสดงความนับถือ” ให้อัตโนมัติทุกเอกสาร ไม่ต้องรอเซ็นทีละใบ</p>
                <div className="flex items-center gap-3">
                  {(sigPreview || letter.signatureUrl) ? (
                    <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-slate-200 bg-white">
                      {sigPreview
                        ? <img src={sigPreview} alt="ลายเซ็น" className="max-h-12 max-w-[120px] object-contain" />
                        : <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Icon name="check" className="h-3.5 w-3.5" /> มีลายเซ็นแล้ว</span>}
                    </div>
                  ) : (
                    <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">ยังไม่มี</div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className={`btn-outline cursor-pointer ${!editing ? 'pointer-events-none opacity-50' : ''}`}>
                      <Icon name="download" className="h-4 w-4" /> {sigUploading ? 'กำลังอัปโหลด…' : 'อัปโหลดลายเซ็น'}
                      <input type="file" accept="image/*" className="hidden" disabled={!editing || sigUploading}
                        onChange={(e) => { uploadSignature(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {(sigPreview || letter.signatureUrl) && (
                      <button type="button" onClick={() => { setL('signatureUrl', ''); setSigPreview(null); }} className="text-xs text-red-500 hover:underline">ลบลายเซ็น</button>
                    )}
                    {!editing && <span className="text-[11px] text-amber-600">บันทึกโครงการก่อน จึงจะอัปโหลดลายเซ็นได้</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">คำลงท้าย</label>
                  <input value={letter.closingLine} onChange={(e) => setL('closingLine', e.target.value)} placeholder="ขอแสดงความนับถือ" className={field} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">ผู้รับเริ่มต้น (เรียน)</label>
                  <input value={letter.defaultRecipient} onChange={(e) => setL('defaultRecipient', e.target.value)} className={field} />
                </div>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(undefined);

  const load = () => adminApi.listProjects().then((r) => setProjects(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleActive = async (p) => {
    try { await adminApi.updateProject(p.id, { isActive: !p.is_active }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มโครงการ</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">โครงการ</th>
              <th className="tbl-th">ชื่อ</th>
              <th className="tbl-th">Prefix</th>
              <th className="tbl-th">ผู้จัดการโครงการ (ผู้ลงนาม)</th>
              <th className="tbl-th">สถานะ</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id} className="tbl-row">
                <td className="tbl-td">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: p.color || '#64748b' }}>{p.code}</span>
                </td>
                <td className="tbl-td text-slate-700">{p.name}</td>
                <td className="tbl-td text-slate-600">{p.doc_prefix}</td>
                <td className="tbl-td">
                  {p.signatory_name ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-700">{p.signatory_name}</span>
                      {p.has_signature
                        ? <span className="chip bg-emerald-50 text-emerald-700" title="ตั้งลายเซ็นแล้ว"><Icon name="check" className="h-3 w-3" /> ลายเซ็น</span>
                        : <span className="chip bg-amber-50 text-amber-700" title="ยังไม่ได้ตั้งลายเซ็น">ยังไม่มีลายเซ็น</span>}
                      {p.manager_email
                        ? <span className="chip bg-blue-50 text-blue-700" title={`อนุมัติอัตโนมัติไปที่ ${p.manager_email}`}><Icon name="check" className="h-3 w-3" /> ผูกอีเมลอนุมัติ</span>
                        : <span className="chip bg-slate-100 text-slate-400" title="ยังไม่ผูกบัญชีสำหรับอนุมัติ">ยังไม่ผูกอีเมล</span>}
                    </div>
                  ) : (
                    <span className="chip bg-amber-50 text-amber-700">ยังไม่ได้ตั้ง</span>
                  )}
                </td>
                <td className="tbl-td">
                  <span className={`chip ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{p.is_active ? 'ใช้งาน' : 'ปิด'}</span>
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setEdit(p)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                  <button onClick={() => toggleActive(p)} className="text-slate-500 hover:underline text-sm">{p.is_active ? 'ปิด' : 'เปิด'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <ProjectModal project={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); load(); }} />
      )}
    </div>
  );
}
