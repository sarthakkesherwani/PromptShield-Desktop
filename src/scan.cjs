const {getEngine,Sanitizer}=require('../detector-bundle.cjs');
function address(row,column){let label='';while(column>0){column--;label=String.fromCharCode(65+column%26)+label;column=Math.floor(column/26);}return label+row;}
function scanSnapshot(snapshot){
 if(snapshot.status!=='snapshot')return {status:snapshot.status,reason:snapshot.reason};
 if(!snapshot.cells.length)return {status:'waiting',reason:'The active sheet has no populated values to inspect.'};
 const engine=getEngine(); let count=0,critical=false;const items=[];
 const firstRow=Math.min(...snapshot.cells.map(cell=>cell.row));
 const headers=new Map(snapshot.cells.filter(cell=>cell.row===firstRow).map(cell=>[cell.column,cell.text.trim().toLowerCase()]));
 const prefixes={name:'My name is ', 'full name':'My name is ', 'customer name':'Customer name: ',password:'password=', 'api key':'api_key=',otp:'OTP: ',aadhaar:'Aadhaar: ',aadhar:'Aadhaar: ', 'bank account':'Bank account: ', 'account number':'Account number: ',upi:'UPI ID: ',salary:'My monthly salary is ',address:'My home address is '};
 for(const cell of snapshot.cells){
  const prefix=cell.row>firstRow?(prefixes[headers.get(cell.column)]||''):'';
  const source=prefix+cell.text;
  const findings=engine.scanTextSegment(source,'cell',address(cell.row,cell.column),{});
  if(!findings.length)continue;
  count+=findings.length;
  critical ||= findings.some(f=>f.is_blocking||f.severity==='critical');
  if(items.length<50){
   // Mask suggestions are previews. Never write into a user's workbook.
   const result=Sanitizer.sanitizePrompt(source,findings,engine);
   items.push({cell:address(cell.row,cell.column),categories:[...new Set(findings.map(f=>f.category))],preview:result.sanitized_content.slice(prefix.length).slice(0,2000)});
  }
 }
 return {status:count?(critical?'risk':'warn'):'clear',sheet:snapshot.sheet,count,items,scanned:snapshot.cells.length,checkedAt:Date.now()};
}
module.exports={scanSnapshot};
