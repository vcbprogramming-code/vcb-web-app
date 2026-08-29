import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CreatedProject, Lang, MeetingFull, MeetingListItem, Project, ProjectId, SessionState, Theme } from './types'
import { api, getToken } from './api/client'
import { makeTr } from './lib/i18n'
import {
  applyLangClass, applyThemeClass, currentLang, currentTheme, isMobile,
  listIsOverlay, setMobilePane, type MobilePane, type Range
} from './lib/ui'
import { prefetchLatest, getCached } from './api/contentCache'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import MeetingList from './components/MeetingList'
import Dashboard from './components/Dashboard'
import ProjectDashboard from './components/ProjectDashboard'
import MeetingDetail from './components/MeetingDetail'
import Timeline from './components/Timeline'
import SettingsModal from './components/SettingsModal'
import AccessModal from './components/AccessModal'
import EditorSignInModal from './components/EditorSignInModal'
import MeetingModal from './components/MeetingModal'
import EditorModal from './components/EditorModal'
import NewProjectModal from './components/NewProjectModal'
import RenameProjectModal from './components/RenameProjectModal'
import { Busy, Toast } from './components/Overlays'

const TIMELINE_PROJECT: ProjectId = 'TIMELINE'

const EMPTY_SESSION: SessionState = {
  appTitle: 'VCB Meeting Minutes', appDisplayTitle: 'Meeting Minutes', subtitle: '',
  authed: true, user: '', isAdmin: false, isEditor: false, projects: [], execUrl: ''
}

// Meetings metadata cache (paints instantly on reload). Mirrors vcb_mm_meetings_cache.
function readMeetingCache(): MeetingListItem[] {
  try { return (JSON.parse(localStorage.getItem('vcb_mm_meetings_cache') || 'null') as MeetingListItem[]) || [] } catch { return [] }
}
function writeMeetingCache(m: MeetingListItem[]): void {
  try { localStorage.setItem('vcb_mm_meetings_cache', JSON.stringify(m || [])) } catch { /* ignore */ }
}

function queryParam(name: string): string {
  try { return new URLSearchParams(window.location.search).get(name) || '' } catch { return '' }
}

export default function App() {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION)
  const [meetings, setMeetings] = useState<MeetingListItem[]>(readMeetingCache())
  const [loaded, setLoaded] = useState(false)
  const [activeProject, setActiveProject] = useState<ProjectId>('ALL')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<Range>('all')
  // Tablet portrait only: the meeting list is a slide-over there so the A4
  // document has room. Inert at every other width, where .list-open matches
  // no CSS rule.
  const [listOpen, setListOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(currentTheme())
  const [lang, setLangState] = useState<Lang>(currentLang())

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  // Editor sign-in. The ✎ Edit button is shown to everyone (the server cannot
  // know a visitor is an editor until they identify themselves), so this is
  // opened when a not-yet-editor clicks it.
  const [signInOpen, setSignInOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [meetingModalTarget, setMeetingModalTarget] = useState<MeetingFull | null>(null)
  const [editorTarget, setEditorTarget] = useState<MeetingFull | null>(null)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [renameProjectId, setRenameProjectId] = useState<ProjectId | null>(null)

  // Debounced full-content search (see searchMeetings) — the instant
  // client-side filter in MeetingList covers title/date/excerpt/attendees;
  // this additionally searches the whole meeting body for a term that didn't
  // make it into the excerpt. Cached per query so repeat keystrokes don't
  // re-hit the server. Mirrors the search handler in JavaScript.html.
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null)
  const searchCache = useRef<Map<string, Set<string>>>(new Map())
  const searchTimer = useRef<number | undefined>(undefined)
  const queryRef = useRef('') // always the latest query, for the debounced callback below

  const [busy, setBusy] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const [bootHidden, setBootHidden] = useState(false)
  const [detailVersion, setDetailVersion] = useState(0) // bump to force project-summary refresh after warm

  const tr = useMemo(() => makeTr(lang), [lang])
  const byId = useMemo(() => {
    const o: Record<string, Project> = {}
    session.projects.forEach(p => { o[p.id] = p })
    return o
  }, [session.projects])

  const onBusy = useCallback((msg: string | null) => setBusy(msg), [])
  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600)
  }, [])

  const refreshAll = useCallback(async () => {
    const [s, m] = await Promise.all([api.getSessionState(getToken()), api.listMeetings(getToken())])
    setSession(s); setMeetings(m); writeMeetingCache(m); setLoaded(true)
    return { s, m }
  }, [])

  // ---- boot ----
  useEffect(() => {
    const pendingMeeting = queryParam('meeting')
    const pendingProject = queryParam('project')
    if ((pendingMeeting || pendingProject) && isMobile()) { setMobilePane('detail') } else { setBootHidden(true) }
    Promise.all([api.getSessionState(getToken()), api.listMeetings(getToken())]).then(([s, m]) => {
      setSession(s); setMeetings(m); writeMeetingCache(m); setLoaded(true)
      // ?project=<id> permalink: switch to THIS project BEFORE activeId is set,
      // so the sidebar highlight and list header land on the project tab, not
      // 'ALL' (activeProject's default) — mirrors the same ordering fix in
      // startApp() (JavaScript.html), which originally set S.activeProject
      // AFTER the first render and left the sidebar highlight wrong.
      if (pendingProject) setActiveProject(pendingProject)
      if (pendingMeeting) {
        setActiveId(pendingMeeting)
      } else if (pendingProject) {
        // Always resolve to THIS project's current latest meeting, computed
        // fresh from the just-loaded meeting list — never a stored meeting id,
        // so the same link keeps pointing at whatever is newest each time it's
        // opened. Mirrors projectLatest(id,1)[0] in JavaScript.html.
        const latest = m
          .filter(x => x.projectId === pendingProject && x.kind !== 'overview')
          .slice()
          .sort((a, b) => {
            if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
            return (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00')
          })[0]
        if (latest) setActiveId(latest.id)
      }
      // If the user already tapped into a meeting from the cached "Latest" tiles
      // while this boot fetch was still in flight, activeId is already set — don't
      // clobber that navigation by forcing the pane back to 'projects'. Without this,
      // a fast tap during load would flash into the meeting and snap right back.
      setActiveId(current => {
        if (isMobile()) setMobilePane(pendingMeeting || pendingProject || current ? 'detail' : 'projects')
        return current
      })
      setBootHidden(true)
      prefetchLatest(s.projects, m, () => setDetailVersion(v => v + 1))
    }).catch(() => { setLoaded(true); setBootHidden(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- mobile back bars (mirror the document click handler) ----
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      let t = e.target as HTMLElement | null
      while (t && t !== document.body) {
        if (t.classList?.contains('mobile-back-btn')) {
          setMobilePane((t.getAttribute('data-back-to') as MobilePane) || 'projects')
          return
        }
        t = t.parentElement
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Leaving the overlay band strands `listOpen`: the CSS stops matching, so
  // nothing on screen can dismiss it. Clear it on resize instead.
  useEffect(() => {
    const onResize = () => { if (!listIsOverlay()) setListOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---- theme / language ----
  const setTheme = (v: Theme) => { setThemeState(v); applyThemeClass(v) }
  const setLang = (v: Lang) => { setLangState(v); applyLangClass(v) }

  // ---- navigation ----
  const pickProject = (id: ProjectId) => {
    setActiveProject(id); setActiveId(null)
    if (isMobile()) setMobilePane('list')
    // Tablet portrait: the list is off-screen, so choosing a project must
    // bring it on or the selection appears to do nothing.
    else if (listIsOverlay()) setListOpen(true)
  }
  const openTimeline = () => {
    setActiveProject(TIMELINE_PROJECT); setActiveId(null)
    if (isMobile()) setMobilePane('list')
    // Timeline hides the list, the ☰ toggle and the scrim, so anything left
    // open there could never be dismissed.
    setListOpen(false)
  }
  const openMeeting = (id: string) => {
    setActiveId(id)
    if (isMobile()) setMobilePane('detail')
    // Picking from the overlay dismisses it, or the document loads behind.
    setListOpen(false)
  }
  const onQuery = (q: string) => {
    setQuery(q); queryRef.current = q
    if (isMobile() && q) setMobilePane('list')
    const trimmed = q.trim()
    window.clearTimeout(searchTimer.current)
    if (!trimmed) { setSearchMatchIds(null); return }
    const cached = searchCache.current.get(trimmed)
    if (cached) { setSearchMatchIds(cached); return }
    searchTimer.current = window.setTimeout(() => {
      api.searchMeetings(trimmed, getToken()).then(ids => {
        const set = new Set(ids)
        searchCache.current.set(trimmed, set)
        // Only apply if the query hasn't changed since this request started.
        if (queryRef.current.trim() === trimmed) setSearchMatchIds(set)
      }).catch(() => { /* silent — instant filter still applies */ })
    }, 350)
  }

  // ---- admin flows ----
  const openNew = () => { setMeetingModalTarget(null); setMeetingModalOpen(true) }
  const openEdit = (m: MeetingFull) => setEditorTarget(m)
  const onProjectCreated = async (p: CreatedProject) => {
    setNewProjectOpen(false)
    await refreshAll()
    pickProject(p.id)
    toast('Created ' + p.name)
  }

  const onMeetingSaved = async (id: string) => {
    setMeetingModalOpen(false)
    await refreshAll(); openMeeting(id)
  }
  const onMeetingDeleted = async () => {
    setMeetingModalOpen(false); setActiveId(null)
    await refreshAll()
  }
  const onEditSaved = async (id: string) => {
    setEditorTarget(null)
    await refreshAll(); setDetailVersion(v => v + 1); openMeeting(id)
  }
  const onEditorDeleted = async () => {
    setEditorTarget(null); setActiveId(null)
    await refreshAll()
  }

  // ---- detail pane content ----
  const detailPane = (() => {
    if (activeProject === TIMELINE_PROJECT && !activeId) {
      return <Timeline projects={session.projects} meetings={meetings} byId={byId} loaded={loaded} onOpen={openMeeting} />
    }
    if (activeId) {
      return (
        <MeetingDetail
          key={activeId} id={activeId} byId={byId} projects={session.projects} isAdmin={session.isAdmin}
          isEditor={session.isEditor}
          userEmail={session.user}
          onToast={toast} onBusy={onBusy} onEdit={openEdit}
          onMutated={() => { refreshAll() }}
          onSignIn={() => setSignInOpen(true)}
          execUrl={session.execUrl} theme={theme}
        />
      )
    }
    if (activeProject === 'ALL') return <Dashboard projects={session.projects} meetings={meetings} onOpen={openMeeting} tr={tr} />
    const p = byId[activeProject]
    if (!p) return null
    return <ProjectDashboard key={`${activeProject}:${detailVersion}`} project={p} meetings={meetings} onOpen={openMeeting} tr={tr} execUrl={session.execUrl} onToast={toast} />
  })()

  // The full record for the New/Edit modal when editing the active meeting.
  const editTarget = meetingModalTarget ?? (activeId ? getCached(activeId) ?? null : null)

  return (
    <div className="app">
      {!bootHidden && <div className="boot-loader"><span className="spin" /></div>}

      <Topbar session={session} query={query} onQuery={onQuery} onSettings={() => setSettingsOpen(true)} tr={tr} />

      <div className={'body'
        + (activeProject === TIMELINE_PROJECT ? ' timeline-mode' : '')
        // Narrower than timeline-mode: the timeline VIEW is showing, i.e. no
        // meeting is open. Opening one from a dot keeps activeProject on
        // TIMELINE, and the rules that hide the list must stop applying then.
        + (activeProject === TIMELINE_PROJECT && !activeId ? ' timeline-only' : '')
        + (listOpen ? ' list-open' : '')}>
        <Sidebar
          projects={session.projects} meetings={meetings} byId={byId} isAdmin={session.isAdmin} isEditor={session.isEditor} loaded={loaded}
          active={activeProject} onPick={pickProject} onOpen={openMeeting} onNew={openNew}
          onNewProject={() => setNewProjectOpen(true)} onRenameProject={setRenameProjectId}
          onTimeline={openTimeline} tr={tr}
        />
        <MeetingList
          meetings={meetings} byId={byId} isAdmin={session.isAdmin}
          activeProject={activeProject} activeId={activeId} query={query} searchMatchIds={searchMatchIds} range={range}
          loaded={loaded} onRange={setRange} onOpen={openMeeting} tr={tr}
        />
        {/* Tapping the document dismisses the overlay — the scrim is a
            ::before on .detail, so the click lands here. onClick rather than
            a document listener: the click that OPENS the panel starts in the
            sidebar and never reaches this element, so there is no
            open-then-immediately-close race to guard against. */}
        <main className="detail" onClick={() => { if (listOpen) setListOpen(false) }}>
          <div className="mobile-backbar">
            <button type="button" className="mobile-back-btn" data-back-to="list">{tr('backMeetings')}</button>
            <span className="backbar-actions" />
          </div>
          {/* Tablet portrait only (CSS-gated): the list gives up its column
              there so the document can be read, and this calls it back. */}
          <button
            type="button" className="list-peek" aria-label={tr('meetingsLabel')}
            onClick={e => { e.stopPropagation(); setListOpen(true) }}
          >
            <span className="list-peek-ic">☰</span>
            <span className="list-peek-lbl">{tr('meetingsLabel')}</span>
          </button>
          <div id="detailContent" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {detailPane}
          </div>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen} onClose={() => setSettingsOpen(false)} session={session}
        theme={theme} lang={lang} setTheme={setTheme} setLang={setLang}
        onAccess={() => { setSettingsOpen(false); setAccessOpen(true) }} tr={tr}
      />
      <EditorSignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignedIn={() => { refreshAll() }}
        onToast={toast} onBusy={onBusy}
      />
      <AccessModal open={accessOpen} onClose={() => { setAccessOpen(false); setSettingsOpen(true) }} onBusy={onBusy} onToast={toast} />
      <MeetingModal
        open={meetingModalOpen} meeting={editTarget} projects={session.projects}
        onClose={() => setMeetingModalOpen(false)} onSaved={onMeetingSaved} onDeleted={onMeetingDeleted}
        onBusy={onBusy} onToast={toast}
      />
      <EditorModal
        meeting={editorTarget} projectName={editorTarget ? byId[editorTarget.projectId]?.name : undefined}
        onClose={() => setEditorTarget(null)} onSaved={onEditSaved} onDeleted={onEditorDeleted}
        onBusy={onBusy} onToast={toast}
      />
      <NewProjectModal
        open={newProjectOpen} onClose={() => setNewProjectOpen(false)}
        onCreated={onProjectCreated} onBusy={onBusy} onToast={toast}
      />
      <RenameProjectModal
        open={!!renameProjectId} project={renameProjectId ? byId[renameProjectId] ?? null : null}
        onClose={() => setRenameProjectId(null)}
        onRenamed={() => { setRenameProjectId(null); refreshAll() }}
        onBusy={onBusy} onToast={toast}
      />

      <Busy msg={busy} />
      <Toast msg={toastMsg} />
    </div>
  )
}
