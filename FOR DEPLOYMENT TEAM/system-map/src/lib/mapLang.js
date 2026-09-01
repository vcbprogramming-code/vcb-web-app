/** Domain-content language helpers — port of tNode/tDoc/tLane/tDept from the
 *  canonical Index.html <script>.
 *
 *  These are NOT the shared i18n. The shared dictionary (../i18n.js) holds the
 *  UI chrome — buttons, tab labels, column headings — keyed by stable dot keys.
 *  What lives here is the *map content*: the Thai translations of individual
 *  node/lane/document records, keyed by the record's own id in LANG_TH. A
 *  dictionary entry per node would mean ~1,000 dot keys mirroring data that is
 *  already structured by id, so the id-keyed lookup stays.
 *
 *  Each takes `lang` explicitly — call it with the `lang` from useI18n().
 */
import { LANG_TH } from '../data/index.js';

/** field: 'label' | 'sub' | 'desc' | 'items' */
export function tNode(lang, node, field) {
  const th = LANG_TH.nodes[node.id];
  const thVal = th ? th[field] : undefined;
  if (lang === 'th' && thVal) return thVal;
  return node[field];
}

/** field: 'label' | 'sub' */
export function tDoc(lang, node, field) {
  const th = LANG_TH.docs[node.id];
  const thVal = th ? th[field] : undefined;
  return lang === 'th' && thVal ? thVal : node[field];
}

export function tLane(lang, lane) {
  return lang === 'th' ? LANG_TH.lanes[lane.id] || lane.label : lane.label;
}

export function tDept(lang, deptKey, name) {
  return lang === 'th' ? LANG_TH.depts[deptKey] || name : name;
}

/** Registry row translation: LANG_TH.registry[code] = [name, notes]. */
export function tRegistryRow(lang, code) {
  return lang === 'th' ? LANG_TH.registry?.[code] || null : null;
}
