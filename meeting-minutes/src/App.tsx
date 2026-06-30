import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lang, MeetingFull, MeetingListItem, Project, ProjectId, SessionState, Theme } from './types'
import { api, getToken } from './api/client'
import { makeTr } from './lib/i18n'
import {
  applyLangClass, applyThemeClass, currentLang, currentTheme, isMobile,
  setMobilePane, type MobilePane, type Range
} from './lib/ui'
import { prefetchLatest, getCached } from './api/contentCache'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import MeetingList from './components/MeetingList'
import Dashboard from './components/Dashboard'
import ProjectDashboard from './components/ProjectDashboard'
import MeetingDetail from './components/MeetingDetail'
import SettingsModal from './components/SettingsModal'
import AccessModal from './components/AccessModal'
import MeetingModal from './components/MeetingModal'
import EditorModal from './components/EditorModal'
import { Busy, Toast } from './components/Overlays'

const EMPTY_SESSION: SessionState = {
  appTitle: 'VCB Meeting Minutes', appDisplayTitle: 'Meeting Minutes', subtitle: '',
  authed: true, user: '', isAdmin: false, projects: [], execUrl: ''
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
  const [theme, setThemeState] = useState<Theme>(currentTheme())
  const [lang, setLangState] = useState<Lang>(currentLang())

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [meetingModalTarget, setMeetingModalTarget] = useState<MeetingFull | null>(null)
  const [editorTarget, setEditorTarget] = useState<MeetingFull | null>(null)

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
    if (pendingMeeting && isMobile()) { setMobilePane('detail') } else { setBootHidden(true) }
    Promise.all([api.getSessionState(getToken()), api.listMeetings(getToken())]).then(([s, m]) => {
      setSession(s); setMeetings(m); writeMeetingCache(m); setLoaded(true)
      if (pendingMeeting) setActiveId(pendingMeeting)
      if (isMobile()) setMobilePane(pendingMeeting ? 'detail' : 'projects')
      setBootHidden(true)
      prefetchLatest(s.projects, m, () => setDetailVersion(v => v + 1))
      // background autoSync (admin only returns changes)
      api.autoSync(getToken()).then(r => { if (r.ok && (r.added || r.updated)) refreshAll() }).catch(() => { /* silent */ })
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

  // ---- theme / language ----
  const setTheme = (v: Theme) => { setThemeState(v); applyThemeClass(v) }
  const setLang = (v: Lang) => { setLangState(v); applyLangClass(v) }

  // ---- navigation ----
  const pickProject = (id: ProjectId) => {
    setActiveProject(id); setActiveId(null)
    if (isMobile()) setMobilePane('list')
  }
  const openMeeting = (id: string) => {
    setActiveId(id)
    if (isMobile()) setMobilePane('detail')
  }
  const onQuery = (q: string) => {
    setQuery(q)
    if (isMobile() && q) setMobilePane('list')
  }

  // ---- admin flows ----
  const openNew = () => { setMeetingModalTarget(null); setMeetingModalOpen(true) }
  const openEdit = (m: MeetingFull) => setEditorTarget(m)

  const manualRefresh = () => {
    setSettingsOpen(false); onBusy(tr('refreshing'))
    api.autoSync(getToken()).then(async r => {
      await refreshAll()
      if (r && (r.added || r.updated)) toast(`${tr('updated')} · ${r.added || 0} ${tr('newWord')}, ${r.updated || 0} ${tr('changedWord')}`)
      else toast(tr('alreadyUpToDate'))
    }).catch(e => toast(tr('refreshFailed') + ': ' + (e instanceof Error ? e.message : String(e)))).finally(() => onBusy(null))
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

  // ---- detail pane content ----
  const detailPane = (() => {
    if (activeId) {
      return (
        <MeetingDetail
          key={activeId} id={activeId} byId={byId} isAdmin={session.isAdmin}
          onToast={toast} onBusy={onBusy} onEdit={openEdit}
          onMutated={() => { refreshAll() }} execUrl={session.execUrl}
        />
      )
    }
    if (activeProject === 'ALL') return <Dashboard projects={session.projects} meetings={meetings} onOpen={openMeeting} tr={tr} />
    const p = byId[activeProject]
    if (!p) return null
    return <ProjectDashboard key={`${activeProject}:${detailVersion}`} project={p} meetings={meetings} onOpen={openMeeting} tr={tr} />
  })()

  // The full record for the New/Edit modal when editing the active meeting.
  const editTarget = meetingModalTarget ?? (activeId ? getCached(activeId) ?? null : null)

  return (
    <div className="app">
      {!bootHidden && <div className="boot-loader"><span className="spin" /></div>}

      <Topbar session={session} query={query} onQuery={onQuery} onSettings={() => setSettingsOpen(true)} tr={tr} />

      <div className="body">
        <Sidebar
          projects={session.projects} meetings={meetings} byId={byId} isAdmin={session.isAdmin}
          active={activeProject} onPick={pickProject} onOpen={openMeeting} onNew={openNew} tr={tr}
        />
        <MeetingList
          meetings={meetings} byId={byId} isAdmin={session.isAdmin}
          activeProject={activeProject} activeId={activeId} query={query} range={range}
          loaded={loaded} onRange={setRange} onOpen={openMeeting} tr={tr}
        />
        <main className="detail">
          <div className="mobile-backbar">
            <button type="button" className="mobile-back-btn" data-back-to="list">{tr('backMeetings')}</button>
            <span className="backbar-actions" />
          </div>
          <div id="detailContent" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {detailPane}
          </div>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen} onClose={() => setSettingsOpen(false)} session={session}
        theme={theme} lang={lang} setTheme={setTheme} setLang={setLang}
        onRefresh={manualRefresh} onAccess={() => { setSettingsOpen(false); setAccessOpen(true) }} tr={tr}
      />
      <AccessModal open={accessOpen} onClose={() => { setAccessOpen(false); setSettingsOpen(true) }} onBusy={onBusy} onToast={toast} />
      <MeetingModal
        open={meetingModalOpen} meeting={editTarget} projects={session.projects}
        onClose={() => setMeetingModalOpen(false)} onSaved={onMeetingSaved} onDeleted={onMeetingDeleted}
        onBusy={onBusy} onToast={toast}
      />
      <EditorModal meeting={editorTarget} onClose={() => setEditorTarget(null)} onSaved={onEditSaved} onBusy={onBusy} onToast={toast} />

      <Busy msg={busy} />
      <Toast msg={toastMsg} />
    </div>
  )
}
