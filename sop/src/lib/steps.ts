/**
 * Steps textarea ⇄ storage conversion, mirrors stepsToStorage/stepsFromStorage/
 * stepDepth in the canonical apps-script/index.html. Shared by EditModal,
 * NewScenarioModal (textarea authoring) and DetailPane (display rendering).
 *
 * Storage format (each entry in Scenario.steps[]):
 *   "N. text"        — numbered top-level step (N is written literally; the
 *                       displayed number is always the running position among
 *                       numbered lines, via the CSS counter in .steps — the
 *                       digit typed only signals "this is a numbered step").
 *   "» text" / "» » text" / …  — sub-bullet, depth = number of '» ' repeats.
 *   "· text"          — plain caption, no number, no bullet.
 *
 * Textarea authoring format (what the user types):
 *   a number ('1.' / '2)' / …) at line start → numbered step
 *   '>' / '>>' at line start                  → tier-2 / tier-3 sub-bullet
 *   neither                                    → plain caption
 */

/** Convert textarea content → storage steps[] array. */
export function stepsToStorage(text: string): string[] {
  let stepNo = 0;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const subM = trimmed.match(/^(>+)\s*/);
      if (subM) {
        const depth = subM[1].length;
        return '» '.repeat(depth) + trimmed.slice(subM[0].length).trim();
      }
      const numM = trimmed.match(/^\d+[.)]\s*/);
      if (numM) {
        stepNo++;
        return stepNo + '. ' + trimmed.slice(numM[0].length).trim();
      }
      return '· ' + trimmed;
    })
    .filter(Boolean);
}

/** Convert storage steps[] array → textarea content (for editing an existing scenario). */
export function stepsFromStorage(steps: string[] | undefined): string {
  return (steps || [])
    .map((line) => {
      if (line.indexOf('· ') === 0) return line.slice(2);
      let depth = 0;
      let rest = line;
      while (rest.indexOf('» ') === 0) {
        depth++;
        rest = rest.slice(2);
      }
      if (depth > 0) return '>'.repeat(depth) + ' ' + rest;
      return rest; // numbered lines already carry their own "N. " prefix
    })
    .join('\n');
}

export interface StepLine {
  kind: 'numbered' | 'sub' | 'caption';
  depth: number; // meaningful for 'sub' only (1, 2, 3…)
  text: string;
}

/** Classify one stored step line for rendering (mirrors stepsHtml's per-line logic). */
export function classifyStep(line: string): StepLine {
  if (line.indexOf('· ') === 0) {
    return { kind: 'caption', depth: 0, text: line.slice(2) };
  }
  let depth = 0;
  let rest = line;
  while (rest.indexOf('» ') === 0) {
    depth++;
    rest = rest.slice(2);
  }
  if (depth > 0) return { kind: 'sub', depth, text: rest };
  return { kind: 'numbered', depth: 0, text: rest.replace(/^\d+\.\s*/, '') };
}
