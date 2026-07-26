import { createContext, useContext, useState, useEffect } from 'react';

/**
 * Lets a page inject its own actions/stats into the shared ModuleShell top bar,
 * so we don't need a second banner. ModuleShell renders `slot`; a page calls
 * useHeaderSlot(node) to fill it (and clears it on unmount).
 */
const HeaderSlotContext = createContext({ slot: null, setSlot: () => {} });

export function HeaderSlotProvider({ children }) {
  const [slot, setSlot] = useState(null);
  return (
    <HeaderSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </HeaderSlotContext.Provider>
  );
}

/** ModuleShell reads this to render whatever the active page injected. */
export function useHeaderSlotValue() {
  return useContext(HeaderSlotContext).slot;
}

/**
 * Page hook: pass the node to show in the top bar. Re-runs whenever `deps`
 * change so live values (counts, etc.) stay fresh. Clears on unmount.
 */
export function useHeaderSlot(node, deps = []) {
  const { setSlot } = useContext(HeaderSlotContext);
  useEffect(() => {
    setSlot(node);
    // Only clear if OUR node is still the one showing — if a newer page already
    // set its own slot before this cleanup runs (route transition), don't blank it. (#D8)
    return () => setSlot((cur) => (cur === node ? null : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
