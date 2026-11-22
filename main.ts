// Driver for the tidy entry. The harness contract: cases arrive as a JSON array of
// {id, input} in /input/cases.json; each case is answered on its own by run() from solve.js;
// the answers go to /output/answers.json as a JSON array in the cases' order. Outside a
// container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Match the house baseline's V8 tuning (no incremental marking), applied before solve.js is
// imported so the flag covers everything the solver does.
setFlagsFromString('--no-incremental-marking');

/** solve.js carries no types; its contract is run(input) -> the reader's answer. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const raw = readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8');
const cases = JSON.parse(raw) as { id: string; input: unknown }[];

const answers: unknown[] = [];
for (const c of cases) {
  answers.push(run(c.input));
}

writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
