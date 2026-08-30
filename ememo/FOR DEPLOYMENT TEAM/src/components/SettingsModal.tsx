import { useStore } from '../store'
import { PREVIEW_OWNER } from '../api'
import AccessControl from './AccessControl'

// การตั้งค่า · Settings (#stModal): theme / language / date-era, signed-in-as,
// admin Access-Control, sign-out. Mirrors toggleSettings + setTheme/setLang/
// setDateEra.
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, setLang, era, setEra, dark, setDark, auth, signIn, signOut } = useStore()
  const seg = (active: boolean) => 'st-seg-btn' + (active ? ' active' : '')
  const isOwner = auth?.email === PREVIEW_OWNER

  return (
    <div className={'st-modal' + (open ? ' show' : '')} role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="st-card">
        <div className="st-head">
          <h3>การตั้งค่า · Settings</h3>
          <button className="st-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="st-body">
          <div className="st-section">
            <div className="st-sect-label">SIGNED IN AS</div>
            <div className="st-sect-value">{auth ? `${auth.email} · ${auth.manager ? 'manager' : 'staff'}` : 'Not signed in'}</div>
            {!auth && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btp" onClick={() => signIn()}>🔐 Sign in (owner)</button>
                <button className="btc" onClick={() => signIn('staff@vcb-con.com')}>Sign in as staff</button>
              </div>
            )}
          </div>
          <hr className="st-divider" />
          <div className="st-section">
            <div className="st-sect-label">การแสดงผล / DISPLAY</div>
            <div className="st-sect-sub">โหมดสี / Theme</div>
            <div className="st-seg">
              <button className={seg(!dark)} onClick={() => setDark(false)}>☀️ สว่าง Light</button>
              <button className={seg(dark)} onClick={() => setDark(true)}>🌙 มืด Dark</button>
            </div>
          </div>
          <div className="st-section">
            <div className="st-sect-sub">ภาษา / Language</div>
            <div className="st-seg">
              <button className={seg(lang === 'th')} onClick={() => setLang('th')}>ไทย / TH</button>
              <button className={seg(lang === 'en')} onClick={() => setLang('en')}>English / EN</button>
            </div>
          </div>
          <div className="st-section">
            <div className="st-sect-sub">รูปแบบวันที่ / Date format</div>
            <div className="st-seg">
              <button className={seg(era === 'be')} onClick={() => setEra('be')}>พ.ศ. (2569)</button>
              <button className={seg(era === 'ce')} onClick={() => setEra('ce')}>ค.ศ. (2026)</button>
            </div>
          </div>
          {isOwner && <AccessControl />}
          {auth && <button className="st-signout" onClick={() => { signOut(); onClose() }}>Sign out</button>}
        </div>
      </div>
    </div>
  )
}
