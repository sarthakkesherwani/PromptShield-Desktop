const {getEngine,Sanitizer}=require('../detector-bundle.cjs');
function address(row,column){let label='';while(column>0){column--;label=String.fromCharCode(65+column%26)+label;column=Math.floor(column/26);}return label+row;}
function scanSnapshot(snapshot,{maxItems=50}={}){
 const itemLimit=Math.max(0,Math.min(20000,Number.isInteger(maxItems)?maxItems:50));
 if(snapshot.status!=='snapshot')return {status:snapshot.status,reason:snapshot.reason};
 if(!snapshot.cells.length)return {status:'waiting',reason:'The active sheet has no populated values to inspect.'};
 const engine=getEngine(); let count=0,affectedCells=0,critical=false,selectedItem;const items=[];
 const replacements=new Map(),counters=new Map();
 const tables=new Map();
 for(const cell of snapshot.cells){const key=cell.tableId??'excel';if(!tables.has(key))tables.set(key,[]);tables.get(key).push(cell);}
 const contexts=new Map();
 for(const [key,cells] of tables){const firstRow=Math.min(...cells.map(cell=>cell.row));contexts.set(key,{firstRow,headers:new Map(cells.filter(cell=>cell.row===firstRow).map(cell=>[cell.column,cell.text.trim().toLowerCase()]))});}
 const prefixes={name:'My name is ', 'full name':'My name is ', 'customer name':'Customer name: ',aadhaar:'Aadhaar: ',aadhar:'Aadhaar: ', 'bank account':'Bank account: ', 'account number':'Account number: ',upi:'UPI ID: ',salary:'My monthly salary is ',address:'My home address is '};
 for(const [id,cell] of snapshot.cells.entries()){
  const {firstRow,headers}=contexts.get(cell.tableId??'excel');
  const location=(cell.table?cell.table+'!':'')+address(cell.row,cell.column);
  const columnHeader=cell.row>firstRow?headers.get(cell.column):undefined;
  const prefix=columnHeader&&Object.hasOwn(prefixes,columnHeader)?prefixes[columnHeader]:'';
  const source=prefix+cell.text;
  const findings=engine.scanTextSegment(source,'cell',location,{columnHeader});
  if(!findings.length)continue;
  affectedCells++;
  count+=findings.length;
  critical ||= findings.some(f=>f.is_blocking||f.severity==='critical');
  const tokens=new Map();
  for(const finding of findings){
   const key=finding.category+'\0'+finding.matched_value;
   if(!replacements.has(key)){
    const seed=Sanitizer.generatePlaceholderMap([{...finding}])[finding.matched_value];
    const kind=seed.replace(/_\d+\]$/,'');const next=(counters.get(kind)||0)+1;counters.set(kind,next);replacements.set(key,kind+'_'+next+']');
   }
   tokens.set(finding,replacements.get(key));
  }
  const selected=snapshot.selected&&snapshot.selected.tableId===cell.tableId&&snapshot.selected.address===address(cell.row,cell.column);
  if(items.length<itemLimit||selected){
   let masked=source;
   for(const finding of [...findings].sort((a,b)=>b.location_meta.start-a.location_meta.start))masked=masked.slice(0,finding.location_meta.start)+tokens.get(finding)+masked.slice(finding.location_meta.end);
   const fullPreview=masked.slice(prefix.length);
   const item={id,cell:location,categories:[...new Set(findings.map(f=>f.category))],preview:fullPreview.slice(0,2000),truncated:fullPreview.length>2000,canApply:fullPreview.length<=2000&&!/^[=+@]/.test(fullPreview)};
   if(items.length<itemLimit)items.push(item);
   if(selected)selectedItem=item;
  }
 }
 return {status:count?(critical?'risk':'warn'):'clear',sheet:snapshot.sheet,source:snapshot.source||'excel',count,affectedCells,items,selectedItem,scanned:snapshot.cells.length,checkedAt:Date.now()};
}
module.exports={scanSnapshot};

