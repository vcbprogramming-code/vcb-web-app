// Single swap point for the data layer. Today it resolves to the typed mock;
// to wire a real backend, implement `Api` over google.script.run (or a proxy)
// and export that instead — no UI changes required.
import type { Api } from './types'
import { mockApi, mockIssueToken, MOCK_OWNER, MOCK_MANAGERS } from './mock'

export const api: Api = mockApi
export * from './types'

/**
 * Stands in for the real OAuth popup → claimAuth flow. In the GAS app the
 * user signs in through a Google popup; here we issue a mock token for the
 * chosen email so role-gated UI (manager actions, admin access) is testable.
 * Defaults to the owner so every flow is reachable in the preview.
 */
export function mockSignIn(email: string = MOCK_OWNER): { token: string; email: string; manager: boolean } {
  const token = mockIssueToken(email)
  return { token, email, manager: MOCK_MANAGERS.has(email) }
}

export const PREVIEW_OWNER = MOCK_OWNER
