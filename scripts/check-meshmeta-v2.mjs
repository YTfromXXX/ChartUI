// Parity check: lib/meshMetaV2.ts must reproduce tests/fixtures/meshmeta_v2_tetra.json (made by Python).
// Run: npm run test:meshmeta
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname; const out = mkdtempSync(join(tmpdir(), 'mm2-'));
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), join(root, 'lib/meshMetaV2.ts'), '--outDir', out, '--target', 'es2022', '--module', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'inherit' });
for (const f of ['meshMetaV2.js', 'meshMeta.js']) writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'"));
writeFileSync(join(out, 'package.json'), '{"type":"module"}');
const m = await import(pathToFileURL(join(out, 'meshMetaV2.js')).href);
const d = JSON.parse(readFileSync(join(root, 'tests/fixtures/meshmeta_v2_tetra.json'), 'utf8'));
const stl = new Uint8Array(Buffer.from(d.stl_hex, 'hex')); let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fails += 1; };
check('keccak256("abc")', m.toHex(m.keccak256(new TextEncoder().encode('abc'))) === '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
check('JCS case', new TextDecoder().decode(m.canonical(d.jcs_case)) === d.jcs_expected);
check('signing bytes', createHash('sha256').update(m.signingBytes(d.meta)).digest('hex') === d.signing_sha256);
const r = await m.verify(stl, d.meta); check(`verify: ${JSON.stringify(r)}`, r.ok);
const built = await m.build(d.vertices, d.triangles);
check('TS build: same STL', Buffer.from(built.stl).toString('hex') === d.stl_hex);
check('TS build: same root', built.meta.merkle.root === d.meta.merkle.root);
check('TS build: same pointers', JSON.stringify(built.meta.pointers) === JSON.stringify(d.meta.pointers));
const bad = stl.slice(); bad[84 + 50 * 3 + 20] ^= 1; check('tampered STL rejected', !(await m.verify(bad, d.meta)).ok);
const moved = structuredClone(d.meta); moved.pointers[0].index = (moved.pointers[0].index + 1) % 10; check('moved pointer rejected', !(await m.verify(stl, moved)).ok);
process.exit(fails ? 1 : 0);
