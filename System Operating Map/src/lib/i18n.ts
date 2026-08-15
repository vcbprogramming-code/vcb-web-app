/** Language helpers — verbatim port of tNode/tDoc/tLane/tUI/tDept/esc from the
 *  canonical Index.html <script>. Each takes `lang` explicitly instead of reading
 *  a global, since React state replaces the original module-level `let lang`.
 */
import { LANG_TH } from '../data';
import type { LaneNode, DocNode } from '../data/types';
import type { Lang } from '../store';

export function tNode(lang: Lang, node: LaneNode, field: 'label' | 'sub' | 'desc'): string;
export function tNode(lang: Lang, node: LaneNode, field: 'items'): string[];
export function tNode(lang: Lang, node: LaneNode, field: 'label' | 'sub' | 'desc' | 'items'): string | string[] {
  const th = LANG_TH.nodes[node.id];
  const thVal = th ? (th as any)[field] : undefined;
  if (lang === 'th' && thVal) return thVal;
  return (node as any)[field];
}

export function tDoc(lang: Lang, node: DocNode, field: 'label' | 'sub'): string {
  const th = LANG_TH.docs[node.id];
  const thVal = th ? (th as any)[field] : undefined;
  return lang === 'th' && thVal ? thVal : (node as any)[field];
}

export function tLane(lang: Lang, lane: { id: string; label: string }): string {
  return lang === 'th' ? LANG_TH.lanes[lane.id] || lane.label : lane.label;
}

export function tUI(lang: Lang, key: string, fallback: string): string {
  if (lang !== 'th') return fallback;
  const v = (LANG_TH.ui as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : fallback;
}

export function tUIObj(lang: Lang, key: string): Record<string, string> | undefined {
  if (lang !== 'th') return undefined;
  const v = (LANG_TH.ui as Record<string, unknown>)[key];
  return typeof v === 'object' ? (v as Record<string, string>) : undefined;
}

export function tDept(lang: Lang, deptKey: string, name: string): string {
  return lang === 'th' ? (LANG_TH.depts as Record<string, string>)[deptKey] || name : name;
}

export function esc(s: string | undefined | null): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
