const test=require('node:test');const assert=require('node:assert/strict');const {scanSnapshot}=require('../src/scan.cjs');
const scan=cells=>scanSnapshot({status:'snapshot',sheet:'Demo',cells});
test('clean cells show green',()=>assert.equal(scan([{row:1,column:1,text:'Quarterly agenda'}]).status,'clear'));
test('email shows warning and only masked output leaves scanner',()=>{
 const result=scan([{row:2,column:2,text:'demo@example.com'}]);
 assert.equal(result.status,'warn');assert.equal(result.items[0].cell,'B2');assert.ok(!JSON.stringify(result).includes('demo@example.com'));
});
test('credentials show red',()=>assert.equal(scan([{row:1,column:1,text:'password=Quartz#999'}]).status,'risk'));
test('column header provides context for a plain password value',()=>{
 const result=scan([{row:1,column:28,text:'Password'},{row:2,column:28,text:'Quartz#999'}]);
 assert.equal(result.status,'risk');assert.equal(result.items[0].cell,'AB2');assert.ok(!result.items[0].preview.includes('Quartz'));
 assert.ok(!result.items[0].preview.includes('password='));
});
test('waiting and incomplete snapshots never show green',()=>{
 for(const status of ['waiting','limited','paused'])assert.equal(scanSnapshot({status,reason:'Unavailable'}).status,status);
});
test('HTML stays inert text in the masked preview',()=>{
 const result=scan([{row:1,column:1,text:'<img src=x onerror=alert(1)> demo@example.com'}]);
 assert.ok(result.items[0].preview.includes('<img'));assert.ok(!result.items[0].preview.includes('demo@example.com'));
});
test('UI results are capped while overall count includes all cells',()=>{
 const result=scan(Array.from({length:60},(_,i)=>({row:i+1,column:1,text:'demo@example.com'})));
 assert.equal(result.items.length,50);assert.equal(result.count,60);
});
test('empty sheets do not show a green assurance',()=>assert.equal(scan([]).status,'waiting'));
test('Numbers headers and locations stay within each table',()=>{
 const result=scanSnapshot({status:'snapshot',source:'numbers',sheet:'Demo',cells:[
  {table:'Accounts',tableId:0,row:1,column:2,text:'Password'},
  {table:'Accounts',tableId:0,row:2,column:2,text:'Quartz#999'},
  {table:'Inventory',tableId:1,row:1,column:2,text:'Description'},
  {table:'Inventory',tableId:1,row:2,column:2,text:'Blue ink'},
 ]});
 assert.equal(result.status,'risk');assert.equal(result.source,'numbers');assert.equal(result.items.length,1);assert.equal(result.items[0].cell,'Accounts!B2');assert.ok(!JSON.stringify(result).includes('Quartz#999'));
});
test('different emails get distinct placeholders while repeated emails stay consistent across cells',()=>{
 const r=scan([{row:1,column:1,text:'Contact'},{row:2,column:1,text:'a@example.com'},{row:3,column:1,text:'b@example.com'},{row:4,column:1,text:'a@example.com'}]);
 assert.deepEqual(r.items.map(item=>item.preview),['[EMAIL_1]','[EMAIL_2]','[EMAIL_1]']);
});
test('selected Numbers cell beyond the first 50 findings remains available for inline review',()=>{
 const cells=Array.from({length:80},(_,i)=>({table:'Contacts',tableId:0,row:i+1,column:1,text:`demo${i}@example.com`}));
 const r=scanSnapshot({status:'snapshot',source:'numbers',documentId:'demo-id',sheet:'Demo',selected:{tableId:0,address:'A75'},cells});
 assert.equal(r.items.length,50);assert.equal(r.count,80);assert.equal(r.selectedItem.cell,'Contacts!A75');assert.equal(r.selectedItem.preview,'[EMAIL_75]');
 const {createTargets}=require('../src/cell-review.cjs');const targets=createTargets({source:'numbers',documentId:'demo-id',sheet:'Demo',cells},r);assert.equal(targets.size,51);assert.equal(targets.get(74).address,'A75');
});
test('the same value in a password and an email column keeps its field-specific replacement',()=>{
 const r=scan([{row:1,column:1,text:'Password'},{row:1,column:2,text:'Email'},{row:2,column:1,text:'demo@example.com'},{row:2,column:2,text:'demo@example.com'}]);
 assert.deepEqual(r.items.map(item=>item.preview),['[PASSWORD_1]','[EMAIL_1]']);
});


test('truncated suggestions cannot be applied to avoid dropping the rest of a cell',()=>{
 const r=scanSnapshot({status:'snapshot',cells:[{row:1,column:1,text:'email: demo@example.com '+ 'ordinary text '.repeat(300)}]});
 assert.equal(r.items[0].preview.length,2000);assert.equal(r.items[0].canApply,false);
});
