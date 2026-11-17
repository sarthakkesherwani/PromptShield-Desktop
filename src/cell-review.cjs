const {execFile}=require('node:child_process');
const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest('hex');
function runFile(file,args,options={}){return new Promise((resolve,reject)=>{
 const {input,...settings}=options;
 const child=execFile(file,args,{timeout:5000,maxBuffer:200000,...settings},(error,out)=>{if(error)return reject(error);try{resolve(JSON.parse(out));}catch{reject(Error('Invalid helper result'));}});
 child.stdin.on('error',()=>{});child.stdin.end(typeof input==='string'?input:undefined);
});}
function createTargets(snapshot,result){
 const targets=new Map();
 if(snapshot.source!=='numbers'||!snapshot.documentId)return targets;
 for(const item of [...(result.items||[]),...(result.selectedItem?[result.selectedItem]:[])]){const cell=snapshot.cells[item.id];if(!cell)continue;let col=cell.column,address='';while(col>0){col--;address=String.fromCharCode(65+col%26)+address;col=Math.floor(col/26);}address+=cell.row;
  targets.set(item.id,{documentId:snapshot.documentId,sheet:snapshot.sheet,table:cell.table,tableId:cell.tableId,address,hash:digest(cell.text),item});
 }
 return targets;
}
async function focusTarget(target,script,mode='focus',runner=runFile){
 const {hash,item,...location}=target;
 const result=await runner('/usr/bin/osascript',['-l','JavaScript',script,JSON.stringify({...location,mode})]);
 if(result.status!=='focused')return {status:result.status};
 if(typeof result.value!=='string'||digest(result.value)!==hash)return {status:'stale'};
 return {status:'focused',original:result.value};
}
async function applyTarget(target,script,runner=runFile){
 if(!target.item.canApply||typeof target.item.preview!=='string'||target.item.preview.length>2000||/^[=+@]/.test(target.item.preview))return {status:'unavailable'};
 const focused=await focusTarget(target,script,'check',runner);
 if(focused.status!=='focused')return {status:focused.status};
 const {hash,item,...location}=target;
 return runner('/usr/bin/osascript',['-l','JavaScript',script,JSON.stringify({...location,mode:'apply'})],{input:JSON.stringify({expected:focused.original,replacement:item.preview})});
}
function positionHint(rect,area,width=310,height=200){
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
 let x=rect.x+rect.width+8;if(x+width>area.x+area.width)x=rect.x-width-8;
 return {x:Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(rect.y,area.y+area.height-height))),width,height};
}
module.exports={createTargets,focusTarget,positionHint,runFile,applyTarget,digest};
