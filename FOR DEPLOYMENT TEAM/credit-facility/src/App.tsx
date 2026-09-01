import { useEffect, useRef } from 'react';
import bodyHtml from './app/body.html?raw';
import legacySrc from './app/legacy.js?raw';
import { installGasShim } from './gas';

// The app is the canonical GAS single-page UI, carried over verbatim:
//  1. the body markup (header / cards / tabs / filter bar / modals / toast)
//     is mounted exactly as authored, preserving every id, class and inline
//     handler the app code relies on;
//  2. the ~2,600-line app logic (app/legacy.js) is executed as a classic
//     script in global scope — identical to how Apps Script serves it — so the
//     inline onclick handlers resolve and behaviour is byte-for-byte the same;
//  3. google.script.run is shimmed to the typed mock backend before boot.
let booted = false;

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (booted) return; // verbatim app assumes a single boot; guard StrictMode/HMR
    booted = true;

    installGasShim();

    // Execute the verbatim app code as a CLASSIC script: top-level function
    // declarations land on window (so inline onclick="fn()" works), and bare
    // element references (rProj, rAmt, …) resolve via named-element access —
    // exactly as in the Apps Script runtime.
    const s = document.createElement('script');
    s.text = legacySrc;
    document.body.appendChild(s);
  }, []);

  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}
