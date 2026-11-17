const test=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const {createMacMonitor}=require('../src/mac-monitor.cjs');
function child(){const c=new EventEmitter();c.stdout=new EventEmitter();c.stdout.setEncoding=()=>{};c.killed=false;c.kill=()=>{c.killed=true;};return c;}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
test('Mac adapter uses fixed executable, parses chunked JSON, and stops polling',async()=>{
 const c=child();let args;const m=createMacMonitor('/resource/script.js',{spawn:(...a)=>{args=a;return c;}});const updates=[];m.stdout.on('data',s=>updates.push(JSON.parse(s)));
 await tick();assert.equal(args[0],'/usr/bin/osascript');assert.deepEqual(args[1],['-l','JavaScript','/resource/script.js']);
 assert.equal(updates[0].status,'waiting');c.stdout.emit('data','{"status":"snapshot",');c.stdout.emit('data','"cells":[]}');c.emit('close',0);assert.equal(updates[1].status,'snapshot');m.kill();
});
test('permission denial exits once and is preserved',async()=>{const c=child();const m=createMacMonitor('script',{spawn:()=>c});let exited=0,result;m.on('exit',()=>exited++);m.stdout.on('data',s=>result=JSON.parse(s));await tick();c.stdout.emit('data','{"status":"permission","reason":"Allow Excel"}');c.emit('close',0);assert.equal(exited,1);assert.equal(result.status,'permission');m.kill();});
test('partial JSON and nonzero exit fail closed',async()=>{const c=child();const m=createMacMonitor('script',{spawn:()=>c});let result;m.stdout.on('data',s=>result=JSON.parse(s));await tick();c.stdout.emit('data','{"status":"snapshot"');c.emit('close',1);assert.equal(result.status,'waiting');m.kill();});
test('pause kills in-flight process and ignores its late result',async()=>{const c=child();const m=createMacMonitor('script',{spawn:()=>c});let count=0;m.stdout.on('data',()=>count++);await tick();m.kill();c.stdout.emit('data','{"status":"snapshot"}');c.emit('close',0);assert.equal(c.killed,true);assert.equal(count,1);});
test('timeouts terminate a stalled Excel request',async()=>{const c=child();const m=createMacMonitor('script',{spawn:()=>c,timeout:5});await new Promise(r=>setTimeout(r,20));assert.equal(c.killed,true);m.kill();});
