const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');

function fixture(t, failInstall = false) {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promptshield-launch-'));
 t.after(() => fs.rmSync(root, {recursive:true, force:true}));
 const project = path.join(root, 'Project with spaces');
 fs.mkdirSync(project);
 for (const name of ['Start-PromptShield.cmd','Start-PromptShield-Windows.cmd']) {
  fs.copyFileSync(path.join(__dirname, '..', name), path.join(project, name));
 }
 // Use the real Node runtime with a stub npm. Never open a GUI or download dependencies.
 const setup = failInstall ? 'exit /b 9' : [
  'mkdir node_modules\\electron 2>nul',
  'mkdir node_modules\\esbuild 2>nul',
  'echo {}>node_modules\\electron\\package.json',
  'echo {}>node_modules\\esbuild\\package.json',
  'copy /y runtime-fixture.cjs node_modules\\electron\\install.js >nul',
  'exit /b 0'
 ].join('\r\n');
 fs.writeFileSync(path.join(project,'npm.cmd'), '@echo off\r\necho %*>>calls.txt\r\nif "%~1"=="ci" goto setup\r\nexit /b 0\r\n:setup\r\n'+setup+'\r\n');
 fs.writeFileSync(path.join(project,'runtime-fixture.cjs'), "const fs=require('node:fs');fs.mkdirSync('node_modules/electron/dist',{recursive:true});fs.writeFileSync('node_modules/electron/dist/electron.exe','fixture');fs.appendFileSync('runtime-calls.txt','installed\\n');");
 function run(name) {
  fs.writeFileSync(path.join(root,'run.cmd'), '@echo off\r\ncall "'+path.join(project,name)+'" <nul\r\nexit /b %errorlevel%\r\n');
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d','/c','run.cmd'], {cwd:root,encoding:'utf8',timeout:20000});
 }
 return {project,run};
}

test('Windows command launch handles spaces, first setup and subsequent starts', {skip:process.platform !== 'win32'}, t => {
 const {project,run} = fixture(t);
 const first = run('Start-PromptShield-Windows.cmd');
 assert.equal(first.status,0,first.stdout+first.stderr);
 assert.match(fs.readFileSync(path.join(project,'calls.txt'),'utf8'), /ci --include=dev --cache .npm-cache/);
 assert.match(fs.readFileSync(path.join(project,'calls.txt'),'utf8'), /start/);
 const second = run('Start-PromptShield.cmd');
 assert.equal(second.status,0,second.stdout+second.stderr);
 const calls = fs.readFileSync(path.join(project,'calls.txt'),'utf8');
 assert.equal(calls.split(/\r?\n/).filter(line=>line.startsWith('ci ')).length,1);
 assert.equal(calls.split(/\r?\n/).filter(line=>line==='start').length,2);
 assert.equal(fs.readFileSync(path.join(project,'runtime-calls.txt'),'utf8'),'installed\n');
});

test('Windows setup failures stop before the app launch', {skip:process.platform !== 'win32'}, t => {
 const {project,run} = fixture(t,true);
 const result = run('Start-PromptShield-Windows.cmd');
 assert.notEqual(result.status,0);
 assert.match(result.stdout,/could not start/);
 assert.ok(!fs.readFileSync(path.join(project,'calls.txt'),'utf8').split(/\r?\n/).includes('start'));
});
