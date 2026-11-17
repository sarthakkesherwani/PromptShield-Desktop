const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/numbers-snapshot-mac.js'),'utf8');
function table({name='Table 1',names=['A1','B1','A2','B2'],values=['Item','Password','Demo','Quartz#999'],rows=2,columns=2,onRead,selection=null}={}){return {name:()=>name,rowCount:()=>rows,columnCount:()=>columns,selectionRange:{name:()=>selection},cells:{name:()=>names,formattedValue:()=>{onRead?.();return values;}}};}
function snapshot({tables=[table()],running=true,legacy=false,documents=true,error}={}){
 const sheet={name:()=> 'Demo',tables};const doc={id:()=> 'demo-id',activeSheet:sheet};
 const app={running:()=>running,documents:documents?[doc]:[]};
 if(error)Object.defineProperty(app,'documents',{get(){throw error;}});
 return JSON.parse(vm.runInNewContext(source+';run();',{Application:id=>{if(legacy&&id==='com.apple.Numbers')throw Error('not installed');return app;}}));
}
test('Numbers uses native coordinates and includes table identity',()=>{const r=snapshot();assert.equal(r.status,'snapshot');assert.equal(r.source,'numbers');assert.deepEqual(r.cells[3],{table:'Table 1',tableId:0,row:2,column:2,text:'Quartz#999'});});
test('Numbers supports the legacy bundle identifier',()=>assert.equal(snapshot({legacy:true}).status,'snapshot'));
test('Numbers waits when closed, no document, or no tables',()=>{for(const input of [{running:false},{documents:false},{tables:[]}])assert.equal(snapshot(input).status,'waiting');});
test('Numbers preserves blank cell positions and skips empty values',()=>{const r=snapshot({tables:[table({values:['Item',null,'Demo','']})]});assert.deepEqual(r.cells.map(c=>[c.row,c.column]),[[1,1],[2,1]]);});
test('Numbers does not infer row order from the returned collection',()=>{const r=snapshot({tables:[table({names:['B2','A1','B1','A2']})]});assert.equal(r.cells[0].row,2);assert.equal(r.cells[0].column,2);});
test('Numbers checks aggregate cell limits before reading values',()=>{let reads=0;const r=snapshot({tables:[table({rows:10000,onRead:()=>reads++}),table({onRead:()=>reads++})]});assert.equal(r.status,'limited');assert.equal(reads,0);});
test('Numbers rejects incomplete tables, duplicate and invalid coordinates',()=>{for(const t of [table({values:['short']}),table({names:['A1','A1','A2','B2']}),table({names:['A1','B1','A2','C2']})])assert.equal(snapshot({tables:[t]}).status,'limited');});
test('Numbers handles columns beyond Z',()=>{const names=Array.from({length:27},(_,i)=>i<26?String.fromCharCode(65+i)+'1':'AA1');const values=names.map(()=> '');values[26]='Sample';assert.equal(snapshot({tables:[table({names,values,rows:1,columns:27})]}).cells[0].column,27);});
test('Numbers refuses oversized cell text and unsupported values',()=>{for(const value of ['x'.repeat(32769),{secret:'private'}])assert.equal(snapshot({tables:[table({values:['Item','Value','Demo',value]})]}).status,'limited');});
test('Numbers permission denial is actionable and never exposes raw errors',()=>{const r=snapshot({error:{errorNumber:-1743,message:'private-sheet'}});assert.equal(r.status,'permission');assert.match(r.reason,/Numbers/);assert.ok(!JSON.stringify(r).includes('private-sheet'));});
test('Numbers table IDs are separate even if names match',()=>{const r=snapshot({tables:[table(),table()]});assert.equal(r.cells[0].tableId,0);assert.equal(r.cells[4].tableId,1);});

test('Numbers identifies a single selected cell for automatic inline hints',()=>assert.deepEqual(snapshot({tables:[table({selection:'B2'})]}).selected,{tableId:0,address:'B2'}));
test('Numbers does not guess an inline target for multiple table selections',()=>assert.equal(snapshot({tables:[table({selection:'B2'}),table({selection:'A1'})]}).selected,null));
test('Numbers does not show a single-cell hint for a selected range',()=>assert.equal(snapshot({tables:[table({selection:'B2:B4'})]}).selected,null));
