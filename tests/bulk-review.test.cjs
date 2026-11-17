const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createBulkPlan,summarizePlan,runBulk}=require('../src/bulk-review.cjs');
const script=fs.readFileSync(path.join(__dirname,'../src/bulk-numbers-mac.js'),'utf8');
function snapshot(count=80){return {status:'snapshot',source:'numbers',documentId:'demo',sheet:'Demo',cells:[{row:1,column:1,text:'Email',table:'Accounts',tableId:0},...Array.from({length:count},(_,i)=>({row:i+2,column:1,text:`demo${i}@example.com`,table:'Accounts',tableId:0}))]};}
test('sheet plan covers every eligible finding beyond the 50-card UI limit',()=>{
 const plan=createBulkPlan(snapshot(600));assert.equal(plan.entries.length,600);assert.equal(plan.entries[599].address,'A601');assert.equal(plan.entries[599].replacement,'[EMAIL_600]');
 assert.equal(plan.entries[0].headerAddress,'A1');const summary=summarizePlan(plan);assert.equal(summary.samples.length,4);assert.ok(!JSON.stringify(summary).includes('demo0@example.com'));
});
test('unsupported sources and incomplete suggestions never enter a write batch',()=>{
 assert.throws(()=>createBulkPlan({...snapshot(),source:'excel'}));const s=snapshot(1);s.cells[1].text+=' words'.repeat(600);assert.equal(createBulkPlan(s).entries.length,0);assert.equal(createBulkPlan(s).ineligible,1);
});
test('chunked bulk masking keeps originals on stdin and creates undo only for confirmed writes',async()=>{
 const plan=createBulkPlan(snapshot(45));let calls=0;const progress=[];
 const result=await runBulk(plan,'helper',{runner:async(file,args,options)=>{calls++;assert.ok(!JSON.stringify(args).includes('@example'));const payload=JSON.parse(options.input);assert.ok(payload.entries.length<=20);return {status:'done',applied:payload.entries.map(e=>e.id),skipped:[]};},onProgress:p=>progress.push(p)});
 assert.equal(calls,3);assert.equal(result.applied,45);assert.equal(result.remaining,0);assert.equal(result.undo[0].expected,'[EMAIL_1]');assert.equal(result.undo[0].replacement,'demo0@example.com');assert.equal(progress.at(-1).processed,45);
});
test('cancel stops subsequent groups while retaining undo for completed cells',async()=>{
 let stop=false;const result=await runBulk(createBulkPlan(snapshot(45)),'helper',{cancelled:()=>stop,runner:async(file,args,options)=>{const p=JSON.parse(options.input);stop=true;return {status:'done',applied:p.entries.map(e=>e.id),skipped:[]};}});
 assert.equal(result.status,'partial');assert.equal(result.applied,20);assert.equal(result.remaining,25);assert.equal(result.undo.length,20);
});
test('stale sheet context stops the batch without claiming untouched cells were written',async()=>{
 const result=await runBulk(createBulkPlan(snapshot(45)),'helper',{runner:async()=>({status:'stale',applied:[],skipped:[]})});assert.equal(result.applied,0);assert.equal(result.unconfirmed,0);assert.equal(result.remaining,45);
});
test('an adapter failure reports uncertain cells and never retries a write blindly',async()=>{
 let calls=0;const result=await runBulk(createBulkPlan(snapshot(45)),'helper',{runner:async()=>{calls++;throw Error('timeout');}});assert.equal(calls,1);assert.equal(result.unconfirmed,20);assert.equal(result.remaining,25);assert.equal(result.undo.length,0);
});
function nativeBatch(entries,{formulaAt,changedAt,header='Email',switchAfterFirst=false}={}){
 const values=new Map([['A1',header],...entries.map(e=>[e.address,e.expected])]);if(changedAt)values.set(changedAt,'Edited by user');let writes=0,sheetName='Demo';
 const table={name:()=> 'Accounts',cells:{byName:address=>({formattedValue:()=>values.get(address),formula:()=>address===formulaAt?'=A1':'',set value(v){values.set(address,v);writes++;if(switchAfterFirst)sheetName='Other';}})}};
 const doc={id:()=> 'demo',activeSheet:{name:()=>sheetName,tables:[table]}};
 const payload=JSON.stringify({documentId:'demo',sheet:'Demo',entries});
 const result=JSON.parse(vm.runInNewContext(script+';run();',{Application:()=>({running:()=>true,documents:[doc]}),ObjC:{import:()=>{},unwrap:v=>v},$:{NSFileHandle:{fileHandleWithStandardInput:{readDataToEndOfFile:payload}},NSString:{alloc:{initWithDataEncoding:v=>v}},NSUTF8StringEncoding:4}}));return {result,values,writes};
}
test('native batch masks ordinary cells while skipping edits and formula cells',()=>{
 const entries=createBulkPlan(snapshot(3)).entries;const r=nativeBatch(entries,{formulaAt:'A3',changedAt:'A4'});assert.equal(r.writes,1);assert.deepEqual(r.result.applied,[0]);assert.deepEqual(r.result.skipped.map(s=>s.reason),['formula','value_changed']);assert.equal(r.values.get('A2'),'[EMAIL_1]');
});
test('native batch rejects changed headers and stops when active sheet changes',()=>{
 const entries=createBulkPlan(snapshot(3)).entries;assert.equal(nativeBatch(entries,{header:'Project'}).writes,0);const r=nativeBatch(entries,{switchAfterFirst:true});assert.equal(r.writes,1);assert.equal(r.result.status,'stale');
});
test('native bulk undo restores unchanged masked cells and preserves later edits',()=>{
 const undo=createBulkPlan(snapshot(2)).entries.map(e=>({...e,headerAddress:undefined,expected:e.replacement,replacement:e.expected}));const r=nativeBatch(undo,{changedAt:'A3'});assert.equal(r.values.get('A2'),'demo0@example.com');assert.equal(r.values.get('A3'),'Edited by user');assert.equal(r.writes,1);
});
