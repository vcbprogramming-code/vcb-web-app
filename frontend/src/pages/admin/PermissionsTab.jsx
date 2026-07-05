import { useEffect, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

/**
 * Action-level permissions editor (backlog round 2 #3). Pick a user, then toggle
 * each module/action. A toggle writes an explicit override; the effective value
 * (role default OR override) is what the checkbox shows. Admins get everything
 * and can't be edited.
 */
export default function PermissionsTab() {
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [effective, setEffective] = useState({}); // { module: { action: bool } }
  const [role, setRole] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  // per-user document visibility (#8)
  const [projects, setProjects] = useState([]);
  const [docCodes, setDocCodes] = useState([]);
  const [visProjects, setVisProjects] = useState([]); // allowed project ids ([] = all)
  const [visCodes, setVisCodes] = useState([]);        // allowed doc codes ([] = all)
  const [visBusy, setVisBusy] = useState(false);
  const [visSaved, setVisSaved] = useState(false);

  useEffect(() => {
    Promise.all([adminApi.listUsers(), adminApi.permissionCatalog(), adminApi.listProjects(), adminApi.listDocCodeApprovers()])
      .then(([u, c, p, dc]) => { setUsers(u.data); setCatalog(c.data); setProjects(p.data); setDocCodes(dc.data); })
      .catch((e) => setError(e.message));
  }, []);

  const selectUser = (id) => {
    setSelectedId(id);
    setSaved(false);
    setVisSaved(false);
    setError(null);
    if (!id) { setEffective({}); setRole(null); setVisProjects([]); setVisCodes([]); return; }
    adminApi.getUserPermissions(id)
      .then((r) => { setEffective(r.data.effective || {}); setRole(r.data.role); })
      .catch((e) => setError(e.message));
    adminApi.getUserVisibility(id)
      .then((r) => { setVisProjects(r.data.projectIds || []); setVisCodes(r.data.docCodes || []); })
      .catch(() => { setVisProjects([]); setVisCodes([]); });
  };

  const toggleVisProject = (pid) => { setVisSaved(false); setVisProjects((prev) => prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]); };
  const toggleVisCode = (code) => { setVisSaved(false); setVisCodes((prev) => prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]); };
  const saveVisibility = async () => {
    setVisBusy(true); setError(null);
    try { await adminApi.saveUserVisibility(selectedId, visProjects, visCodes); setVisSaved(true); }
    catch (e) { setError(e.message); }
    finally { setVisBusy(false); }
  };

  const toggle = (module, action) => {
    setSaved(false);
    setEffective((prev) => ({
      ...prev,
      [module]: { ...(prev[module] || {}), [action]: !(prev[module]?.[action]) },
    }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // send the whole effective map as the override set (explicit + resolved)
      await adminApi.saveUserPermissions(selectedId, effective);
      setSaved(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const isAdmin = role === 'admin';

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">เลือกผู้ใช้</label>
        <select value={selectedId} onChange={(e) => selectUser(e.target.value)} className="field">
          <option value="">— เลือกผู้ใช้ —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.email}) · {ROLE_LABELS[u.role] || u.role}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {selectedId && isAdmin && (
        <div className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
          ผู้ดูแลระบบมีสิทธิ์ทุกอย่างโดยอัตโนมัติ — ไม่ต้องตั้งค่าสิทธิ์
        </div>
      )}

      {selectedId && !isAdmin && (
        <>
          <p className="text-xs text-slate-400">
            ติ๊กเพื่อให้สิทธิ์ · เอาติ๊กออกเพื่อห้าม (ค่าเริ่มต้นมาจากบทบาทของผู้ใช้ กดเพื่อปรับเฉพาะคนนี้)
          </p>
          <div className="space-y-4">
            {catalog.map((mod) => (
              <div key={mod.module} className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 border-b border-slate-200">{mod.label}</div>
                <div className="divide-y divide-slate-100">
                  {mod.actions.map((a) => {
                    const on = Boolean(effective[mod.module]?.[a.key]);
                    return (
                      <label key={a.key} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50">
                        <span className="text-sm text-slate-700">{a.label}</span>
                        <button
                          type="button"
                          onClick={() => toggle(mod.module, a.key)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-brand' : 'bg-slate-300'}`}
                          aria-pressed={on}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึกสิทธิ์'}</button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                <Icon name="check" className="h-4 w-4" /> บันทึกแล้ว
              </span>
            )}
          </div>

          {/* per-user document visibility (#8) */}
          <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 border-b border-slate-200">
              การมองเห็นเอกสาร (E-Memo)
            </div>
            <div className="space-y-4 p-4">
              <p className="text-xs text-slate-400">
                เลือกโครงการ/ประเภทที่ผู้ใช้คนนี้มองเห็นได้ — <b>ถ้าไม่เลือกเลย = เห็นทุกเอกสาร</b> ·
                ถ้าเลือกบางอัน จะเห็นเฉพาะเอกสารที่ตรงกับที่เลือกเท่านั้น
              </p>

              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">โครงการที่เห็นได้ {visProjects.length === 0 && <span className="text-emerald-600">(ทุกโครงการ)</span>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {projects.map((p) => {
                    const on = visProjects.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggleVisProject(p.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
                        {p.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">ประเภท/รหัสที่เห็นได้ {visCodes.length === 0 && <span className="text-emerald-600">(ทุกประเภท)</span>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {docCodes.map((c) => {
                    const on = visCodes.includes(c.code);
                    return (
                      <button key={c.code} type="button" onClick={() => toggleVisCode(c.code)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                        title={c.department || ''}>
                        {c.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={saveVisibility} disabled={visBusy} className="btn-primary">{visBusy ? 'กำลังบันทึก…' : 'บันทึกการมองเห็น'}</button>
                {(visProjects.length > 0 || visCodes.length > 0) && (
                  <button onClick={() => { setVisProjects([]); setVisCodes([]); setVisSaved(false); }} className="text-sm text-slate-500 hover:text-slate-800">ล้าง (เห็นทุกเอกสาร)</button>
                )}
                {visSaved && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                    <Icon name="check" className="h-4 w-4" /> บันทึกแล้ว
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
