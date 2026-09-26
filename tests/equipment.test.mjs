// The WPI Assist app copied into the Equipment tab (tools/sync-equipment.mjs): its stylesheet must have been built
// from the cost comparison's current styles, and index.html must load the current version of each file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { costCompCss, fingerprint, STAMPED, stamp } from '../tools/cost-comp-css.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const RESYNC = 'run `npm run sync-equipment -- <path to a repequipment checkout>`';

test('equipment.css cancels the cost comparison styles as they are now', () => {
  const m = /cost comparison styles: ([0-9a-f]{12})/.exec(fs.readFileSync(path.join(PUB, 'assets/css/equipment.css'), 'utf8'));
  assert.ok(m, 'equipment.css has no fingerprint of the cost comparison styles; ' + RESYNC);
  assert.equal(m[1], fingerprint(costCompCss(PUB)), 'index.html’s <style> or scan.css changed since equipment.css was built; ' + RESYNC);
});

test('index.html loads the current version of each app file', () => {
  const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  for (const f of STAMPED) {
    const v = [...index.matchAll(new RegExp(f.replace(/[.\/]/g, '\\$&') + '\\?v=([\\w.-]+)', 'g'))].map(x => x[1]);
    assert.ok(v.length, 'index.html doesn’t load ' + f);
    assert.deepEqual([...new Set(v)], [stamp(PUB, f)], f + ' changed without a new ?v= stamp; ' + RESYNC);
  }
});
