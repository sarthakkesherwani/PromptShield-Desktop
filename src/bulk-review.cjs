const {randomUUID}=require('node:crypto');
const {scanSnapshot}=require('./scan.cjs');
const {createTargets,runFile}=require('./cell-review.cjs');
function createBulkPlan(snapshot){
 if(snapshot?.status!=='snapshot'||snapshot.source!=='numbers'||!snapshot.documentId)throw Error('Scan an active Numbers sheet first.');
 const result=scanSnapshot(snapshot,{maxItems:20000});
 const entries=[],categories={};let ineligible=0;
 const firstRows=new Map();for(const cell of snapshot.cells)firstRows.set(cell.tableId,Math.min(firstRows.get(cell.tableId)??Infinity,cell.row));
 const headers=new Map();for(const cell of snapshot.cells)if(cell.row===firstRows.get(cell.tableId))headers.set(cell.tableId+'!'+cell.column,cell);
 for(const target of createTargets(snapshot,result).values()){
  const cell=snapshot.cells[target.item.id];
  if(!target.item.canApply){ineligible++;continue;}
  const column=target.address.replace(/[0-9]+$/,'');
  const header=headers.get(cell.tableId+'!'+cell.column);
  const entry={id:entries.length,tableId:target.tableId,table:target.table,address:target.address,expected:cell.text,replacement:target.item.preview};
  if(header&&header.row!==cell.row){entry.headerAddress=column+header.row;entry.headerExpected=header.text;}
  entries.push(entry);for(const category of target.item.categories)categories[category]=(categories[category]||0)+1;
 }
 return {id:randomUUID(),documentId:snapshot.documentId,sheet:snapshot.sheet,entries,ineligible,categories};
}
function summarizePlan(plan){return {id:plan.id,sheet:plan.sheet,cells:plan.entries.length,ineligible:plan.ineligible,categories:plan.categories,samples:plan.entries.slice(0,4).map(e=>({cell:e.table+'!'+e.address,replacement:e.replacement}))};}
async function runBulk(plan,script,{runner=runFile,cancelled=()=>false,onProgress=()=>{},chunkSize=20}={}){
 const applied=[],skipped=[];let halted=false,unconfirmed=0;
 for(let offset=0;offset<plan.entries.length;offset+=chunkSize){
  if(cancelled()){halted=true;break;}
  const entries=plan.entries.slice(offset,offset+chunkSize);
  try{
   const result=await runner('/usr/bin/osascript',['-l','JavaScript',script],{input:JSON.stringify({documentId:plan.documentId,sheet:plan.sheet,entries}),timeout:20000,maxBuffer:100000});
   const allowed=new Set(entries.map(e=>e.id));
   if(!result||!Array.isArray(result.applied)||!Array.isArray(result.skipped))throw Error('Invalid batch response');
   const reportedIds=[...result.applied,...result.skipped.map(s=>s.id)];if(reportedIds.some(id=>!allowed.has(id))||new Set(reportedIds).size!==reportedIds.length)throw Error('Invalid batch response');
   applied.push(...entries.filter(e=>result.applied.includes(e.id)));skipped.push(...result.skipped);
   const reported=new Set([...result.applied,...result.skipped.map(s=>s.id)]);if(result.status!=='stale')unconfirmed+=entries.filter(e=>!reported.has(e.id)).length;
   if(result.status!=='done'||unconfirmed){halted=true;break;}
  }catch{unconfirmed+=entries.length;halted=true;break;}
  onProgress({total:plan.entries.length,processed:offset+entries.length,applied:applied.length,skipped:skipped.length});
 }
 return {status:halted?'partial':'done',total:plan.entries.length,applied:applied.length,skipped:skipped.length,unconfirmed,remaining:Math.max(0,plan.entries.length-applied.length-skipped.length-unconfirmed),undo:applied.map(e=>({id:e.id,tableId:e.tableId,table:e.table,address:e.address,expected:e.replacement,replacement:e.expected}))};
}
module.exports={createBulkPlan,summarizePlan,runBulk};
