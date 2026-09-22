import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const file = process.argv[2] || 'extension/manifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(manifest.manifest_version, 3);
for (const script of manifest.content_scripts || []) {
  for (const name of script.js) assert.ok(fs.existsSync(path.join(path.dirname(file), name)));
}
console.log(manifest.content_scripts?.length ? 'CAPTURE_ENABLED' : 'CAPTURE_DISABLED');
