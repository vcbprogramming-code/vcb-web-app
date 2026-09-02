import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useMinutesData } from './MinutesData';
import * as minutesApi from './lib/minutesApi';
import { ALL_PROJECTS, TIMELINE_PROJECT, latestInProject } from './lib/minutes';
import { Busy, Toast } from './ui';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import MeetingList from './components/MeetingList';
import Dashboard from './components/Dashboard';
import ProjectDashboard from './components/ProjectDashboard';
import MeetingDetail from './components/MeetingDetail';
import Timeline from './components/Timeline';
import SettingsModal from './components/SettingsModal';
import AccessPage from './components/AccessPage';
import MeetingModal from './components/MeetingModal';
import EditorModal from './components/EditorModal';
import ProjectModal from './components/ProjectModal';

/**
 * The shell: three panes, the modals, and the navigation between them.
 *
 * App.tsx was 358 lines holding the data layer, the mobile pane machinery, the
 * search debounce and six modal flags at once. The data moved to MinutesData,
 * the domain rules to lib/minutes.js, and the mobile panes to CSS — what is
 * left is navigation and which dialog is open.
 *
 * Routing is React Router 6, and the URL is the source of truth for what is
 * selected. The old app read ?meeting= / ?project= once at boot and then kept
 * the selection in useState, so the back button did nothing and a reload lost
 * the meeting. Those query parameters are still honoured — every link already
 * pasted into a chat uses them — but they now redirect onto a real route.
 */
export default function App() {
  // No top-level strings of its own: every label in this shell belongs to a
  // child component, which reaches for useI18n itself.
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  // /timeline has no path parameter of its own, so it is recognised by route
  // rather than by a param that would always be undefined.
  const onTimelineRoute = location.pathname.startsWith('/timeline');
  const [search, setSearch] = useSearchParams();
  const { meetings, projectsById, refresh, getCached } = useMinutesData();

  const activeProject = params.projectId || ALL_PROJECTS;
  const activeId = params.meetingId || null;

  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [meetingModal, setMeetingModal] = useState(null); // { meeting } | null
  const [editorTarget, setEditorTarget] = useState(null);
  const [projectModal, setProjectModal] = useState(null); // { project } | null

  const [busy, setBusy] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(undefined);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* ------------------------------ legacy links ---------------------------- */

  // ?meeting=<id> and ?project=<id> are the links already in people's chat
  // history. A project link always resolves to whatever is CURRENTLY latest —
  // never a stored id — so the same link keeps pointing at the newest minutes
  // each time it is opened.
  useEffect(() => {
    const legacyMeeting = search.get('meeting');
    const legacyProject = search.get('project');
    if (!legacyMeeting && !legacyProject) return;

    if (legacyMeeting) {
      navigate(`/m/${encodeURIComponent(legacyMeeting)}`, { replace: true });
      return;
    }
    // Wait for the list before resolving "latest", or the link lands on an
    // empty project tab and stays there.
    if (!meetings.length) return;
    const latest = latestInProject(meetings, legacyProject);
    navigate(latest ? `/m/${encodeURIComponent(latest.id)}` : `/p/${encodeURIComponent(legacyProject)}`, {
      replace: true,
    });
    setSearch({}, { replace: true });
  }, [search, meetings, navigate, setSearch]);

  /* -------------------------------- search -------------------------------- */

  // The instant filter in MeetingList covers title/date/excerpt/attendees. This
  // additionally searches the whole body server-side, debounced, and its ids
  // are merged into that filter rather than replacing it.
  const [searchMatchIds, setSearchMatchIds] = useState(null);
  const searchCache = useRef(new Map());
  const searchTimer = useRef(undefined);
  const queryRef = useRef('');

  const onQuery = useCallback((q) => {
    setQuery(q);
    queryRef.current = q;
    const trimmed = q.trim();

    window.clearTimeout(searchTimer.current);
    if (!trimmed) {
      setSearchMatchIds(null);
      return;
    }
    const cached = searchCache.current.get(trimmed);
    if (cached) {
      setSearchMatchIds(cached);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      minutesApi
        .searchMeetings(trimmed)
        .then((ids) => {
          const set = new Set(ids || []);
          searchCache.current.set(trimmed, set);
          // Only apply if the query has not moved on since this went out.
          if (queryRef.current.trim() === trimmed) setSearchMatchIds(set);
        })
        .catch(() => {
          // Silent: the instant filter still works, and a failed background
          // search is not something the person typing asked for.
        });
    }, 350);
  }, []);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  /* ------------------------------ navigation ------------------------------ */

  const pickProject = (id) =>
    navigate(id === ALL_PROJECTS ? '/' : `/p/${encodeURIComponent(id)}`);
  const openTimeline = () => navigate('/timeline');
  const openMeeting = (id) => navigate(`/m/${encodeURIComponent(id)}`);

  /* -------------------------------- flows --------------------------------- */

  const afterMeetingSaved = async (id) => {
    setMeetingModal(null);
    await refresh();
    openMeeting(id);
  };

  const afterMeetingDeleted = async () => {
    setMeetingModal(null);
    setEditorTarget(null);
    await refresh();
    navigate('/');
  };

  const afterEditSaved = async (id) => {
    setEditorTarget(null);
    await refresh();
    openMeeting(id);
  };

  const afterProjectDone = async (project) => {
    setProjectModal(null);
    await refresh();
    if (project?.id) pickProject(project.id);
  };

  /* ------------------------------ detail pane ----------------------------- */

  let detail;
  if (onTimelineRoute) {
    detail = <Timeline onOpen={openMeeting} />;
  } else if (activeId) {
    detail = (
      <MeetingDetail
        key={activeId}
        id={activeId}
        onEdit={setEditorTarget}
        onToast={toast}
        onBusy={setBusy}
      />
    );
  } else if (activeProject === ALL_PROJECTS) {
    detail = <Dashboard onOpen={openMeeting} />;
  } else {
    const project = projectsById[activeProject];
    detail = project ? (
      <ProjectDashboard project={project} onOpen={openMeeting} onToast={toast} />
    ) : null;
  }

  // Which sidebar row is highlighted. A meeting highlights its own project, so
  // opening one from the dashboard does not leave the rail on "All".
  const highlighted = onTimelineRoute
    ? TIMELINE_PROJECT
    : activeId
      ? getCached(activeId)?.projectId ||
        meetings.find((m) => m.id === activeId)?.projectId ||
        ALL_PROJECTS
      : activeProject;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar query={query} onQuery={onQuery} onSettings={() => setSettingsOpen(true)} />

      {/* Three panes on a wide screen; on a narrow one the rail and the list
          stack above the document rather than competing with it for width. The
          Apps Script app swapped whole panes with .mobile-pane-* classes and a
          document-level click handler; a responsive grid does the same job
          without any JavaScript at all. */}
      {/* On the timeline the middle column collapses to 0, as
          .body.timeline-mode does in the original: the timeline renders in the
          document pane and wants the width. It stays mounted rather than
          unmounting so the document pane does not reflow on toggle. */}
      <div
        className={
          'grid min-h-0 flex-1 grid-cols-1 ' +
          (onTimelineRoute
            ? 'lg:grid-cols-shell-timeline-sm xl:grid-cols-shell-timeline-md 2xl:grid-cols-shell-timeline'
            : 'lg:grid-cols-shell-sm xl:grid-cols-shell-md 2xl:grid-cols-shell')
        }
      >
        <Sidebar
          active={highlighted}
          onPick={pickProject}
          onNewMeeting={() => setMeetingModal({ meeting: null })}
          onNewProject={() => setProjectModal({ project: null })}
          onRenameProject={(id) => setProjectModal({ project: projectsById[id] })}
          onTimeline={openTimeline}
        />

        <MeetingList
          activeProject={highlighted}
          activeId={activeId}
          query={query}
          searchMatchIds={searchMatchIds}
          range={range}
          onRange={setRange}
          onOpen={openMeeting}
        />

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface-card dark:bg-surface-dark-card">
          {detail}
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenAccess={() => {
          setSettingsOpen(false);
          setAccessOpen(true);
        }}
      />

      {accessOpen ? (
        <AccessPage
          onClose={() => {
            setAccessOpen(false);
            setSettingsOpen(true);
          }}
          onToast={toast}
          onBusy={setBusy}
        />
      ) : null}

      <MeetingModal
        open={!!meetingModal}
        meeting={meetingModal?.meeting || null}
        onClose={() => setMeetingModal(null)}
        onSaved={afterMeetingSaved}
        onDeleted={afterMeetingDeleted}
        onToast={toast}
        onBusy={setBusy}
      />

      <EditorModal
        meeting={editorTarget}
        onClose={() => setEditorTarget(null)}
        onSaved={afterEditSaved}
        onDeleted={afterMeetingDeleted}
        onToast={toast}
        onBusy={setBusy}
      />

      <ProjectModal
        open={!!projectModal}
        project={projectModal?.project || null}
        onClose={() => setProjectModal(null)}
        onDone={afterProjectDone}
        onToast={toast}
        onBusy={setBusy}
      />

      <Busy message={busy} />
      <Toast message={toastMsg} />
    </div>
  );
}

