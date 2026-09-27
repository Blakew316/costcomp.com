// The Integration Atlas copied into the Integrations tab (tools/sync-integrations.mjs): its styles stay inside the tab, its
// script compiles and carries the whole directory, and every element it looks up is on its page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'integrations');
const css = fs.readFileSync(path.join(DIR, 'atlas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = fs.readFileSync(path.join(DIR, 'atlas.js'), 'utf8');
const RESYNC = 'run `npm run sync-integrations -- <path to an Integrations checkout>`';

test('every Atlas style is scoped to the Integrations tab', () => {
  const selectors = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[2]).filter(s => !/^(from|to|\d+%)$/.test(s));
  assert.ok(selectors.length > 100, 'atlas.css looks empty; ' + RESYNC);
  for (const list of selectors)
    for (const sel of list.split(/,(?![^(]*\))/).map(s => s.trim()))
      assert.match(sel, /^(body\.dark |html\.pwa )?(#atlas\b|#at-)/, 'unscoped selector in atlas.css: ' + sel);
});

test('the Atlas script compiles and carries all 624 brands', () => {
  assert.doesNotThrow(() => new vm.Script(js), 'atlas.js doesn’t compile; ' + RESYNC);
  const m = /^const DATA = \/\*[^*]*\*\/(\[.*\]);\s*$/m.exec(js);
  assert.ok(m, 'atlas.js has no directory; ' + RESYNC);
  const brands = JSON.parse(m[1]);
  assert.equal(brands.length, 624);
  assert.ok(brands.every(b => b.name && b.category && typeof b.rank === 'number'), 'a brand is missing its name, category or rank');
});

test('every element the Atlas script looks up has a prefixed id on its page', () => {
  const ids = new Set([...js.replace(/^const (DATA|WPI_LOGO_B64)\s*=.*$/gm, '').matchAll(/\bid=\\?"(at-[\w-]+)\\?"/g)].map(m => m[1]));
  ids.add('at-toast');   // created by the script when it first shows a message
  const used = [...js.matchAll(/\$\('([\w-]+)'\)/g)].map(m => 'at-' + m[1]);
  assert.ok(used.length > 10);
  for (const id of used) assert.ok(ids.has(id), 'the Atlas script looks up #' + id + ' but its page has no such element; ' + RESYNC);
  assert.ok(!/getElementById\('(?!at-|atlas|tab-integrations)/.test(js), 'the Atlas script looks up an element without the at- prefix');
});
