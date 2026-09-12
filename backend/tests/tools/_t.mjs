import { U, call } from '../harness.mjs';
const r = await call('/portal/today', { user: U.admin });
console.log(r.status, JSON.stringify(r.data).slice(0, 200));
process.exit(0);
