import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useI18n } from '@vcb/shared';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Dashboard, { initialsFromName } from './Dashboard';
import HelpModal from './HelpModal';
import AnnouncementEditor from './AnnouncementEditor';
import Tooltip, { useTooltip } from './Tooltip';
import { getAnnouncement, listApps } from './lib/portalApi';
import { isDismissed, markDismissed } from './lib/announcementDismissal';

/**
 * Turn an email into something to greet a person by, the way the Apps Script
 * portal did: local part, separators to spaces, each word capitalised.
 */
function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  const name = local.replace(/[._-]+/g, ' ').replace(/\b([a-z])/g, (_m, c) => c.toUpperCase());
  return name || email || '';
}

export default function App() {
  const { t } = useI18n();
  const { user, loading: authLoading, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [apps, setApps] = useState([]);
  const [appsError, setAppsError] = useState('');
  const [announcement, setAnnouncement] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isAdmin = hasRole('portal', 'admin');

  /* ------------------------------ tile list ------------------------------ */
  // Refetched once auth settles: an admin also gets the disabled tiles, and
  // whether the caller is an admin is only known after /api/auth/me answers.
  useEffect(() => {
    if (authLoading) return undefined;
    const controller = new AbortController();

    listApps({ includeDisabled: isAdmin, signal: controller.signal })
      .then((list) => {
        setApps(Array.isArray(list) ? list : []);
        setAppsError('');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // The tile list is the whole point of the front door, so a failure is
        // said out loud rather than left as an empty grid that looks like
        // "there are no apps".
        setAppsError(t('apps.loadFailed'));
      });

    return () => controller.abort();
  }, [authLoading, isAdmin, t]);

  /* ----------------------------- announcement ---------------------------- */
  useEffect(() => {
    if (authLoading) return undefined;
    const controller = new AbortController();

    getAnnouncement({ signal: controller.signal })
      .then((ann) => setAnnouncement(ann ?? null))
      // A missing banner is not worth an error message on the front door —
      // the panel simply says there are no announcements.
      .catch(() => setAnnouncement(null));

    return () => controller.abort();
  }, [authLoading, isAdmin]);

  // Has this device already dismissed this exact announcement?
  //
  // `id` is String(revision) now, and was a uuid before the port. A browser
  // holding the old value simply fails the comparison and sees the banner
  // again — isDismissed() compares opaque strings and never parses, so a stale
  // uuid can only produce false. See lib/announcementDismissal.js.
  useEffect(() => {
    setBannerDismissed(announcement ? isDismissed(announcement.id) : false);
  }, [announcement]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    if (announcement) markDismissed(announcement.id);
  }, [announcement]);

  /* -------------------------------- identity ----------------------------- */
  const greeting = useMemo(() => {
    if (authLoading) return t('portal.connecting');
    if (!user) return t('portal.guest');
    return user.name || nameFromEmail(user.email);
  }, [authLoading, user, t]);

  const initials = authLoading ? '?' : initialsFromName(greeting);
  const userTitle = user?.email || '';

  /* --------------------------------- admin ------------------------------- */
  // The editor is a route, so a link to it survives a reload and the browser
  // back button closes it. ?admin=1 from the old build still works and is
  // rewritten to the route, so an existing bookmark does not break.
  const editorOpen = location.pathname === '/admin';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('admin') === '1' && location.pathname === '/') {
      navigate('/admin', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const closeEditor = useCallback(() => navigate('/'), [navigate]);

  const { state: tooltipState, bind: bindTooltip } = useTooltip();

  const dashboard = (
    <Dashboard
      apps={apps}
      appsError={appsError}
      announcement={announcement}
      bannerDismissed={bannerDismissed}
      onDismissBanner={dismissBanner}
      greeting={greeting}
      query={query}
      bindTooltip={bindTooltip}
    />
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        apps={apps}
        greeting={greeting}
        initials={initials}
        userTitle={userTitle}
        onHelp={() => setHelpOpen(true)}
        bindTooltip={bindTooltip}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          query={query}
          onQuery={setQuery}
          onMenu={() => setSidebarOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onAdmin={() => navigate('/admin')}
          showAdmin={isAdmin}
          greeting={greeting}
          initials={initials}
          userTitle={userTitle}
        />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={dashboard} />
            {/* The editor is a modal over the dashboard, so the route renders
                the same page underneath rather than a blank one. */}
            <Route path="/admin" element={dashboard} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Tooltip state={tooltipState} />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} apps={apps} />

      <AnnouncementEditor
        open={editorOpen}
        onClose={closeEditor}
        onSaved={(saved) => {
          setAnnouncement(saved ?? null);
          // A save bumps `revision`, so the id changes and every device —
          // including this one — should see the new banner.
          setBannerDismissed(false);
        }}
      />
    </div>
  );
}
