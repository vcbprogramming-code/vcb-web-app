// Client bridge. In the GAS app this is google.script.run; for the standalone
// React build it routes to the typed mock layer with a small latency so loaders
// and busy states behave like the real round-trip.
//
// Why mock-only for standalone deploy: the GAS server functions are reachable
// solely through google.script.run inside the GAS-served iframe — there is no
// CORS JSON endpoint on the /exec URL (doGet only serves HTML + diag/seed). A
// Vercel-hosted SPA therefore cannot call them over HTTP. The mock mirrors the
// contracts exactly; see PORT_NOTES.md.

import type { ServerApi } from '../types'
import { mockApi } from './mock'

const LATENCY = 240

function delay<T>(fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => { Promise.resolve().then(fn).then(resolve, reject) }, LATENCY)
  })
}

// The app session token (parity with the GAS client; unused by the mock auth,
// which derives identity from the simulated Google session).
export function getToken(): string {
  try { return localStorage.getItem('vcb_mm_token') || '' } catch { return '' }
}

// Latency-wrapped, fully typed facade over the server API.
export const api: ServerApi = {
  getSessionState: (t) => delay(() => mockApi.getSessionState(t)),
  listMeetings: (t) => delay(() => mockApi.listMeetings(t)),
  getMeeting: (id, t) => delay(() => mockApi.getMeeting(id, t)),
  autoSync: (t) => delay(() => mockApi.autoSync(t)),
  togglePin: (id, t) => delay(() => mockApi.togglePin(id, t)),
  setVisibility: (id, v, t) => delay(() => mockApi.setVisibility(id, v, t)),
  saveMeeting: (o, t) => delay(() => mockApi.saveMeeting(o, t)),
  deleteMeeting: (id, t) => delay(() => mockApi.deleteMeeting(id, t)),
  saveEdit: (id, h, w, t) => delay(() => mockApi.saveEdit(id, h, w, t)),
  getProjectAccess: (t) => delay(() => mockApi.getProjectAccess(t)),
  setProjectDomain: (id, a, t) => delay(() => mockApi.setProjectDomain(id, a, t)),
  addProjectViewer: (id, e, t) => delay(() => mockApi.addProjectViewer(id, e, t)),
  removeProjectViewer: (id, e, t) => delay(() => mockApi.removeProjectViewer(id, e, t))
}
