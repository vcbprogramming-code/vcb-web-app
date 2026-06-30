// google.script.run shim. The verbatim app code (app/legacy.js) calls
//   google.script.run.withSuccessHandler(cb).withFailureHandler(cb).method(args)
// exactly as it does inside Apps Script. This installs a window.google whose
// `run` getter hands back a fresh runner per access (so concurrent in-flight
// calls don't clobber each other's success/failure handlers), dispatching to
// the typed mock backend asynchronously like the real GAS transport.

import { mockApi, type MockApi } from './mock/api';

type AnyFn = (...args: unknown[]) => unknown;

function makeRunner(api: MockApi) {
  let onSuccess: AnyFn | null = null;
  let onFailure: AnyFn | null = null;

  const handler: ProxyHandler<Record<string, never>> = {
    get(_t, prop: string) {
      if (prop === 'withSuccessHandler') {
        return (cb: AnyFn) => { onSuccess = cb; return proxy; };
      }
      if (prop === 'withFailureHandler') {
        return (cb: AnyFn) => { onFailure = cb; return proxy; };
      }
      // Any other property is treated as a server method call.
      return (...args: unknown[]): undefined => {
        const fn = (api as unknown as Record<string, AnyFn>)[prop];
        Promise.resolve()
          .then(() => {
            if (typeof fn !== 'function') throw new Error('Unknown server function: ' + prop);
            return fn(...args);
          })
          .then((r) => { if (onSuccess) onSuccess(r); })
          .catch((e: unknown) => {
            const err = e instanceof Error ? e : new Error(String(e));
            if (onFailure) onFailure(err);
            else throw err;
          });
        return undefined;
      };
    },
  };

  const proxy = new Proxy({} as Record<string, never>, handler);
  return proxy;
}

export function installGasShim(): void {
  const google = {
    script: {
      // Fresh runner per access — matches Apps Script's per-call semantics.
      get run() { return makeRunner(mockApi); },
    },
  };
  (window as unknown as { google: typeof google }).google = google;
}
