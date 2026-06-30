/** Banner: brand mark, search, (hidden) admin badge, settings gear, user pill. */
import type { Store } from '../store';
import { Icon } from '../lib/icons';

const PORTAL_URL =
  'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxqIk8Qql3XWXIWn_p0f0FSd04i-FcWZjoXgRErlU5bTXUkpujbQ4ZN4mWco6HEQFUB/exec';

export default function TopBar({ s }: { s: Store }) {
  const pillText = s.userEmail ? s.userEmail + (s.isAdmin ? ' · admin' : '') : '';
  const pillTitle = s.userEmail
    ? (s.lang === 'en' ? 'Signed in as ' : 'เข้าใช้งานในชื่อ ') +
      s.userEmail +
      (s.isAdmin ? ' (admin)' : '')
    : '';

  return (
    <header className="topbar">
      <div className="brand-txt">
        <a
          className="brand-h1 brand-link"
          href={PORTAL_URL}
          target="_top"
          title={s.t('backToPortal')}
        >
          VCB Group
        </a>
        <span className="brand-div"></span>
        <div className="brand-stack">
          <span className="brand-sub">Mango ERP Standard Operating Procedure</span>
          <span className="brand-th">กลุ่มวิจิตรภัณฑ์ก่อสร้าง · มาตรฐานการใช้งานระบบ</span>
        </div>
      </div>
      <div className="hdr-right">
        <div className="search">
          <span className="search-ico">
            <Icon name="search" />
          </span>
          <input
            id="q"
            type="text"
            placeholder={s.t('searchPh')}
            autoComplete="off"
            value={s.nav.q}
            onChange={(e) => s.onSearch(e.target.value)}
          />
        </div>
        {/* Admin badge: present for DOM parity but never shown (admin is shown via the pill suffix). */}
        <span
          className="tbtn admin-badge"
          id="adminBadge"
          style={{ display: 'none' }}
          title="คุณกำลังใช้งานในโหมดผู้ดูแล สามารถแก้ไขกรณีศึกษาได้"
        >
          <Icon name="shield" />
          <span>Admin</span>
        </span>
        <div className="settings-wrap">
          <button
            className={'settings-btn' + (s.syncing ? ' is-syncing' : '')}
            id="settingsBtn"
            type="button"
            onClick={s.openSettings}
            title="ตั้งค่า · Settings"
          >
            <Icon name="settings" />
          </button>
        </div>
        <span
          className="user-pill"
          title={pillTitle}
          style={{ display: s.userEmail ? undefined : 'none' }}
        >
          <span>{pillText}</span>
        </span>
      </div>
    </header>
  );
}
