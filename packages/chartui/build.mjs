// Copies the dependency-free modules from ../../lib into src/ and compiles them to dist/.
// The app keeps the only copy of the code; this package is built from it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); const lib = join(here, '..', '..', 'lib');
export const MODULES = { knots: 'knotCrossings', ladder: 'knotLadder', meshmeta: 'meshMeta', colour: 'smokeCandle', glass: 'glassKnot', slots: 'cardSlots', fx: 'fxOrientation' };
rmSync(join(here, 'src'), { recursive: true, force: true }); rmSync(join(here, 'dist'), { recursive: true, force: true }); mkdirSync(join(here, 'src'));
// Node ESM needs file extensions on relative imports: './knotCrossings' → './knotCrossings.js'.
for (const f of Object.values(MODULES)) writeFileSync(join(here, 'src', `${f}.ts`), readFileSync(join(lib, `${f}.ts`), 'utf8').replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'"));
writeFileSync(join(here, 'src', 'index.ts'), `${Object.entries(MODULES).map(([ns, f]) => `export * as ${ns} from './${f}.js';`).join('\n')}\nexport const VERSION = '0.1.0';\n`);
const tsc = join(here, '..', '..', 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-p', join(here, 'tsconfig.json')], { stdio: 'inherit' });
console.log('built', Object.keys(MODULES).join(', '));
