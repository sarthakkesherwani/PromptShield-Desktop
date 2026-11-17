const test=require('node:test'),assert=require('node:assert/strict');const {resolveSource}=require('../src/monitor-source.cjs');
test('Numbers is available only on macOS',()=>{assert.equal(resolveSource('darwin','numbers').script,'numbers-snapshot-mac.js');assert.throws(()=>resolveSource('win32','numbers'),/macOS only/);});
test('Excel remains available on macOS and Windows',()=>{for(const platform of ['darwin','win32'])assert.equal(resolveSource(platform).label,'Excel');});
test('untrusted IPC source strings cannot choose arbitrary scripts',()=>{for(const source of ['../../script','Numbers','',null,{}])assert.throws(()=>resolveSource('darwin',source),/Choose/);});
