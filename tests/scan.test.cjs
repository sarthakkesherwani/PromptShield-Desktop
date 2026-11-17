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

