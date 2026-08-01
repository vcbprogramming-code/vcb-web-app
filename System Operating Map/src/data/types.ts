/** Shared types for the System Operating Map data layer.
 *  Mirrors the untyped object/array literals in the canonical Index.html <script>.
 */

export type DeptKey = 'eng' | 'pm' | 'proc' | 'fin' | 'acc' | 'asset' | 'hr';
// LANG_TH.depts also carries a 'site' key used only for Function Registry tabs.
export type DeptKeyOrSite = DeptKey | 'site';

export interface Dept {
  name: string;
  color: string;
  icon: string;
}

export type Depts = Record<DeptKey, Dept>;

export interface LaneNodeRoute {
  n: string;
  d: string;
}

export interface LaneNode {
  id: string;
  type: 'erp' | 'manual';
  dept: DeptKey;
  dept2?: DeptKey;
  standalone?: boolean;
  loc?: 'site';
  label: string;
  sub: string;
  desc: string;
  module: string;
  unverified: boolean;
  erp_style?: string;
  erp_label?: string;
  items: string[];
  routes?: LaneNodeRoute[];
}

export interface Lane {
  id: string;
  label: string;
  nodes: LaneNode[];
}

export type ConnType = 'trigger' | 'conditional' | 'feeds' | 'deferred';

export interface CrossConn {
  from: string;
  to: string;
  type: ConnType;
  label?: string;
  feedback?: boolean;
}

export interface DocNode {
  id: string;
  siteOrigin?: boolean;
  code: string;
  label: string;
  dept: DeptKey;
  sub: string;
  erp_style: 'manual' | 'direct' | 'deferred' | 'conditional';
  erp_label: string;
  desc: string;
  items: string[];
}

export interface ModuleInfo {
  name: string;
  purpose: string;
}

export type Modules = Record<string, ModuleInfo>;

export interface AiOpp {
  title: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'High' | 'Medium' | 'Low';
  desc: string;
  tool: string;
}

export type AiOpps = Record<string, AiOpp>;

/** [code, name, erpType, module, notes, isExternalEntry?] */
export type FunctionRow = [string, string, string, string, string, boolean?];

export type FunctionRegistry = Record<string, FunctionRow[]>;

export interface LangThNode {
  label?: string;
  sub?: string;
  desc?: string;
  items?: string[];
}

export interface LangThDoc {
  label?: string;
  sub?: string;
}

export interface LangThUi {
  [key: string]: string | Record<string, string>;
}

export interface LangTh {
  lanes: Record<string, string>;
  nodes: Record<string, LangThNode>;
  docs: Record<string, LangThDoc>;
  ui: LangThUi;
  depts: Record<DeptKeyOrSite, string>;
  registry: Record<string, [string, string]>;
}

export type NodeFn = Record<string, string[]>;
export type FunctionOwner = Record<string, string>;
export type FunctionLoc = Set<string>;
export type FunctionDept2 = Record<string, string>;
export type AiRegistryFns = Set<string>;
export type FieldActCodes = Set<string>;

export interface DeptMetaEntry {
  name: string;
  short: string;
  icon: string;
  color: string;
}
export type DeptMeta = Record<DeptKey, DeptMetaEntry>;

export interface FunctionAiEntry {
  en: string;
  th: string;
  tool: string;
}
export type FunctionAi = Record<string, FunctionAiEntry>;

export interface Stage {
  id: string;
  n: string;
  icon: string;
  t: string;
  mods: string[];
  lanes: string[];
  d: string;
}

export interface SupportItem {
  id: string;
  icon: string;
  t: string;
  mods: string[];
  lanes: string[];
  d: string;
}
