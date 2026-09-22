import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const mode = process.argv[2];
assert.ok(['BASELINE','MODIFIED','ROLLBACK'].includes(mode));
const records=[];
function run(command,args) {
  const result=spawnSync(command,args,{encoding:'utf8',timeout:90000});
  records.push({command:[command,...args],input:'no stdin; files and isolated browser fixtures',stdout:result.stdout,stderr:result.stderr,exit:result.status});
  fs.writeFileSync(`artifacts/${mode.toLowerCase()}-commands.json`,JSON.stringify(records,null,2)+'\n');
  assert.equal(result.status,0,`${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
const sha = file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const original='artifacts/original-manifest.json';
assert.equal(sha(original),'2f0cc1571676b619cf5c963ed1a7dae1c3e07e80ef673f8d2c697c6c9e9588d5');
if(mode==='MODIFIED') {
  assert.equal(run('node',['tests/check.mjs','extension/manifest.json']).trim(),'CAPTURE_ENABLED');
  const output=run('node',['--test','tests/unit.test.mjs']);
  assert.match(output,/pass 5/);
  const browser=run('node',['tests/browser.mjs']);
  assert.match(browser,/BROWSER_PASS:/);
  console.log('MODIFIED_PASS: CAPTURE_ENABLED; UNIT_5_PASS; BROWSER_PASS');
} else {
  const target=`artifacts/${mode==='BASELINE'?'baseline':'rollback'}-extension`;
  fs.mkdirSync(target,{recursive:true});
  if(mode==='BASELINE') fs.copyFileSync(original,path.join(target,'manifest.json'));
  else {
    fs.cpSync('extension',target,{recursive:true});
    run('bash',['artifacts/ROLLBACK.sh',path.resolve(target)]);
  }
  assert.equal(sha(path.join(target,'manifest.json')),sha(original));
  assert.equal(run('node',['tests/check.mjs',path.join(target,'manifest.json')]).trim(),'CAPTURE_DISABLED');
  assert.equal(run('node',['tests/browser.mjs',path.resolve(target)]).trim(),'BROWSER_CAPTURE_DISABLED');
  console.log(`${mode}_PASS: CAPTURE_DISABLED; BROWSER_CAPTURE_DISABLED; ORIGINAL_SHA256_MATCH`);
}
