// The cost comparison's own styles: index.html's <style> blocks and scan.css. tools/sync-equipment.mjs cancels them
// inside the WPI Assist app and records their fingerprint in equipment.css; tests/equipment.test.mjs checks that the
// fingerprint still matches, so a change to these styles can't leave equipment.css cancelling the old ones.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function costCompCss(pub) {
  const index = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  return [...index.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n') + '\n' + fs.readFileSync(path.join(pub, 'scan.css'), 'utf8');
}
export const fingerprint = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
// the files index.html loads with a ?v= stamp: the hash of each file's own content, so it changes exactly when the file does
export const STAMPED = ['assets/js/data.js', 'assets/js/app.js', 'assets/css/equipment.css'];
export const stamp = (pub, f) => fingerprint(fs.readFileSync(path.join(pub, f)));
