const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
test('Show cell keeps the live monitor connected throughout manual review',async()=>{
 const target={documentId:'demo',sheet:'Demo',tableId:0,address:'B2',hash:'digest'};let disconnected=0;const updates=[];
 const context={bulkRunning:false,process:{platform:'darwin'},mainSender:()=>true,latestResult:{revision:7,monitoring:true},targets:new Map([[0,target]]),reviewEpoch:0,hint:{},manualReviewing:false,autoHintKey:null,
  disconnect:()=>{disconnected++;},send:data=>updates.push(data),resource:x=>x,focusTarget:async()=>({status:'focused',original:'synthetic@example.com'}),showCellHint:async()=>({status:'focused',reason:'Monitoring continues.'})};
 context.hideHint=()=>{context.reviewEpoch++;};
 const review=vm.runInNewContext('('+source.slice(source.indexOf('async function reviewCell('),source.indexOf('let inlineEnabled='))+')',context);
 const result=await review({},0,7);
 assert.equal(result.status,'focused');assert.equal(disconnected,0);assert.equal(context.manualReviewing,false);assert.ok(context.autoHintKey);assert.ok(!updates.some(x=>x.monitoring===false));
});
test('automatic selection refresh does not interrupt an in-progress manual review',async()=>{
 let hidden=0;const context={bulkRunning:false,process:{platform:'darwin'},inlineEnabled:true,manualReviewing:true,hintApplying:false,hideHint:()=>hidden++};
 const auto=vm.runInNewContext('('+source.slice(source.indexOf('async function automaticHint('),source.indexOf('app.whenReady()'))+')',context);
 await auto({source:'numbers'});assert.equal(hidden,0);
});
