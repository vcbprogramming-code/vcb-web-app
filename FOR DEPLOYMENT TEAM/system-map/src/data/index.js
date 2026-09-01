/** Barrel re-export of the data layer — mirrors the top-level `const` declarations
 *  in the canonical Index.html <script> block, split one-constant-per-file.
 *
 *  There is no types.js: the old types.ts held only TypeScript interfaces, which
 *  describe shapes the data already has. The shapes are documented where they
 *  matter (lib/derived.js, and the JSDoc on each consumer) instead.
 */
export { DEPTS } from './depts.js';
export { LANES } from './lanes.js';
export { CROSS_CONNS } from './crossConns.js';
export { DOC_NODES } from './docNodes.js';
export { MODULES } from './modules.js';
export { AI_OPPS } from './aiOpps.js';
export { FUNCTION_REGISTRY } from './functionRegistry.js';
export { LANG_TH } from './langTh.js';
export { NODE_FN } from './nodeFn.js';
export { FUNCTION_OWNER } from './functionOwner.js';
export { FUNCTION_HIDE } from './functionHide.js';
export { FUNCTION_LOC } from './functionLoc.js';
export { FUNCTION_DEPT2 } from './functionDept2.js';
export { AI_REGISTRY_FNS } from './aiRegistryFns.js';
export { FIELD_ACT_CODES } from './fieldActCodes.js';
export { DEPT_META } from './deptMeta.js';
export { FUNCTION_AI } from './functionAi.js';
export { STAGES } from './stages.js';
export { SUPPORT } from './support.js';
