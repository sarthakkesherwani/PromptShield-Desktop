const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createTargets,focusTarget,positionHint}=require('../src/cell-review.cjs');
function fixture(){const snapshot={source:'numbers',documentId:'demo-id',sheet:'Demo',cells:[{row:2,column:28,tableId:0,table:'Accounts',text:'Quartz#999'}]};const result={items:[{id:0,cell:'Accounts!AB2',preview:'[SECRET_1]'}]};return createTargets(snapshot,result).get(0);}
test('review target stores a digest and coordinates, never raw cell text',()=>{const target=fixture();assert.equal(target.address,'AB2');assert.ok(!JSON.stringify(target).includes('Quartz'));});
test('focus helper keeps raw selected value local and out of process arguments',async()=>{let args;const result=await focusTarget(fixture(),'helper','focus',async(file,a)=>{args=a;return {status:'focused',value:'Quartz#999'};});assert.equal(result.status,'focused');assert.equal(result.original,'Quartz#999');assert.ok(!JSON.stringify(args).includes('Quartz'));});
test('changed cell values invalidate the reviewed replacement',async()=>assert.equal((await focusTarget(fixture(),'helper','check',async()=>({status:'focused',value:'Changed'}))).status,'stale'));
test('permission denial and stale location are preserved',async()=>{for(const status of ['permission','stale'])assert.equal((await focusTarget(fixture(),'helper','focus',async()=>({status}))).status,status);});
test('on-cell hints stay within the display bounds and reject invalid geometry',()=>{const area={x:0,y:0,width:1000,height:800};assert.deepEqual(positionHint({x:900,y:750,width:70,height:25},area),{x:582,y:600,width:310,height:200});assert.equal(positionHint({x:NaN,y:0,width:10,height:10},area),null);});
const script=fs.readFileSync(path.join(__dirname,'../src/focus-numbers-mac.js'),'utf8');
function navigate({value='Quartz#999',selected='B2',sheetName='Demo',docId='demo-id',mode='focus'}={}){let activated=false;const table={name:()=> 'Accounts',ranges:{byName:address=>({name:()=>address})},cells:{byName:()=>({formattedValue:()=>value})},selectionRange:{name:()=>selected}};const app={running:()=>true,documents:[{id:()=>docId,activeSheet:{name:()=>sheetName,tables:[table]}}],activate:()=>{activated=true;}};const result=JSON.parse(vm.runInNewContext(script+`;run(${JSON.stringify([JSON.stringify({documentId:'demo-id',sheet:'Demo',table:'Accounts',tableId:0,address:'B2',mode})])});`,{Application:()=>app}));return {result,activated,table};}
test('Show cell selects the requested Numbers range without changing values',()=>{const r=navigate();assert.equal(r.result.status,'focused');assert.equal(r.table.selectionRange.name(),'B2');assert.equal(r.activated,true);});
test('review check does not refocus or silently follow a different selection',()=>{assert.equal(navigate({mode:'check'}).activated,false);assert.equal(navigate({mode:'check',selected:'C3'}).result.status,'stale');});
test('review navigation refuses changed documents or sheets',()=>{assert.equal(navigate({docId:'different'}).result.status,'stale');assert.equal(navigate({sheetName:'Other'}).result.status,'stale');});

const {applyTarget}=require('../src/cell-review.cjs');
test('apply rechecks the digest and keeps expected sensitive text out of process arguments',async()=>{
 const target=fixture();target.item.canApply=true;let written;
 const result=await applyTarget(target,'helper',async(file,args,options)=>{
  assert.ok(!JSON.stringify(args).includes('Quartz'));
  if(JSON.parse(args[3]).mode==='check')return {status:'focused',value:'Quartz#999'};
  written=JSON.parse(options.input);return {status:'applied'};
 });
 assert.equal(result.status,'applied');assert.deepEqual(written,{expected:'Quartz#999',replacement:'[SECRET_1]'});
});
test('apply refuses changed values and incomplete replacements before writing',async()=>{
 const target=fixture();target.item.canApply=true;let calls=0;
 assert.equal((await applyTarget(target,'helper',async()=>{calls++;return {status:'focused',value:'changed'};})).status,'stale');assert.equal(calls,1);
 target.item.canApply=false;assert.equal((await applyTarget(target,'helper',()=>{throw Error('must not run');})).status,'unavailable');
});
function applyInNumbers({selected='B2',value='Quartz#999',expected='Quartz#999',formula='',replacement='[PASSWORD_1]'}={}){
 let current=value,writes=0;const cell={formattedValue:()=>current,formula:()=>formula,set value(v){current=v;writes++;}};
 const table={name:()=> 'Accounts',selectionRange:{name:()=>selected},cells:{byName:()=>cell}};
 const app={running:()=>true,documents:[{id:()=> 'demo-id',activeSheet:{name:()=> 'Demo',tables:[table]}}]};
 const payload=JSON.stringify({expected,replacement});
 const result=JSON.parse(vm.runInNewContext(script+`;run(${JSON.stringify([JSON.stringify({documentId:'demo-id',sheet:'Demo',table:'Accounts',tableId:0,address:'B2',mode:'apply'})])});`,{Application:()=>app,ObjC:{import:()=>{},unwrap:v=>v},$:{NSFileHandle:{fileHandleWithStandardInput:{readDataToEndOfFile:payload}},NSString:{alloc:{initWithDataEncoding:v=>v}},NSUTF8StringEncoding:4}}));
 return {result,current,writes};
}
test('explicit apply changes just the verified selected cell',()=>{const r=applyInNumbers();assert.equal(r.result.status,'applied');assert.equal(r.current,'[PASSWORD_1]');assert.equal(r.writes,1);});
test('apply fails closed on selection changes, edited values, formulas and formula-like replacements',()=>{
 for(const options of [{selected:'C3'},{value:'changed'},{formula:'=B3'},{replacement:'=HYPERLINK("x")'}]){const r=applyInNumbers(options);assert.notEqual(r.result.status,'applied');assert.equal(r.writes,0);}
});
test('Numbers single-cell ranges B2:B2 and absolute cell coordinates remain reviewable',()=>{
 for(const selected of ['B2:B2','$B$2:$B$2']){assert.equal(navigate({mode:'check',selected}).result.status,'focused');assert.equal(applyInNumbers({selected}).result.status,'applied');}
 assert.equal(applyInNumbers({selected:'B2:C3'}).writes,0);
});
