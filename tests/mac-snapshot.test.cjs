const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/excel-snapshot-mac.js'),'utf8');
function snapshot({values=[['hello']],row=3,column=2,rows=values.length,columns=values[0].length,running=true,error}={}){
 const range={rows:{length:rows},columns:{length:columns},rowIndex:()=>row,columnIndex:()=>column,value:()=>values};
 const excel={running:()=>running,workbooks:{length:1},activeSheet:{usedRange:range,name:()=> 'Test'}};
 return JSON.parse(vm.runInNewContext(source+';run();',{Application:()=>{if(error)throw error;return excel;}}));
}
test('Mac snapshot preserves absolute cell references, numbers and booleans',()=>{
 const r=snapshot({values:[['hello',42],[false,'']]});assert.equal(r.status,'snapshot');assert.deepEqual(r.cells,[{row:3,column:2,text:'hello'},{row:3,column:3,text:'42'},{row:4,column:2,text:'false'}]);
});
test('closed Excel waits',()=>assert.equal(snapshot({running:false}).status,'waiting'));
test('denied permission gives actionable message without raw error',()=>{const r=snapshot({error:{errorNumber:-1743,message:'private workbook'}});assert.equal(r.status,'permission');assert.ok(!JSON.stringify(r).includes('private workbook'));});
test('oversized range is refused before reading values',()=>assert.equal(snapshot({rows:20001}).status,'limited'));
test('malformed matrix never receives snapshot status',()=>assert.equal(snapshot({values:[['ok'],[]],columns:1}).status,'limited'));
test('large text is refused',()=>assert.equal(snapshot({values:[['x'.repeat(32769)]]}).status,'limited'));
test('unsupported objects fail closed',()=>assert.equal(snapshot({values:[[{secret:1}]]}).status,'limited'));
test('scalar single cell is supported',()=>assert.equal(snapshot({values:'hello',rows:1,columns:1}).cells[0].text,'hello'));
