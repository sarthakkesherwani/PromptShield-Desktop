/* Writes only the exact reviewed cells; sensitive text arrives over stdin. */
function run(){
 var applied=[],skipped=[];
 try{
  ObjC.import('Foundation');
  var input=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  var request=JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input,$.NSUTF8StringEncoding)));
  if(!request||typeof request.documentId!=='string'||typeof request.sheet!=='string'||!Array.isArray(request.entries)||request.entries.length>20)throw Error();
  var ids={},locations={};
  for(var n=0;n<request.entries.length;n++){
   var e=request.entries[n],location=e.tableId+'!'+e.address;
   if(!Number.isInteger(e.id)||ids[e.id]||locations[location]||!Number.isInteger(e.tableId)||e.tableId<0||typeof e.table!=='string'||!/^([A-Z]+)([1-9][0-9]*)$/.test(e.address)||typeof e.expected!=='string'||typeof e.replacement!=='string'||e.expected===e.replacement||e.replacement.length>32768||/^[=+@]/.test(e.replacement))throw Error();
   if(e.headerAddress&&(!/^[A-Z]+[1-9][0-9]*$/.test(e.headerAddress)||typeof e.headerExpected!=='string'))throw Error();
   ids[e.id]=true;locations[location]=true;
  }
  var numbers;for(var a=0;a<2;a++){try{var candidate=Application(a===0?'com.apple.Numbers':'com.apple.iWork.Numbers');if(candidate.running()){numbers=candidate;break;}}catch(_){}}
  if(!numbers||!numbers.documents.length)return JSON.stringify({status:'stale',applied:applied,skipped:skipped});
  var doc=numbers.documents[0];
  for(var i=0;i<request.entries.length;i++){
   var entry=request.entries[i];
   if(!numbers.documents.length||numbers.documents[0].id()!==request.documentId||String(doc.activeSheet.name())!==request.sheet)return JSON.stringify({status:'stale',applied:applied,skipped:skipped});
   var tables=doc.activeSheet.tables;
   if(tables.length<=entry.tableId||String(tables[entry.tableId].name())!==entry.table){skipped.push({id:entry.id,reason:'table_changed'});continue;}
   var table=tables[entry.tableId],cell=table.cells.byName(entry.address);
   if(entry.headerAddress&&String(table.cells.byName(entry.headerAddress).formattedValue())!==entry.headerExpected){skipped.push({id:entry.id,reason:'header_changed'});continue;}
   if(String(cell.formattedValue())!==entry.expected){skipped.push({id:entry.id,reason:'value_changed'});continue;}
   if(String(cell.formula()||'').trim()){skipped.push({id:entry.id,reason:'formula'});continue;}
   cell.value=entry.replacement;
   if(String(cell.formattedValue())===entry.replacement)applied.push(entry.id);
   else return JSON.stringify({status:'unconfirmed',applied:applied,skipped:skipped});
  }
  return JSON.stringify({status:'done',applied:applied,skipped:skipped});
 }catch(error){return JSON.stringify({status:Number(error.errorNumber)===-1743?'permission':'unavailable',applied:applied,skipped:skipped});}
}
