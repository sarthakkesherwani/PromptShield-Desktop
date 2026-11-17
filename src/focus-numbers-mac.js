/* Navigation is read-only. Apply writes one explicitly reviewed, unchanged cell. */
function run(args) {
 try {
  var target=JSON.parse(args[0]);
  if(!target||!Number.isInteger(target.tableId)||target.tableId<0||!/^([A-Z]+)([1-9][0-9]*)$/.test(target.address))throw Error();
  var numbers;
  for(var i=0;i<2;i++){try{var app=Application(i===0?'com.apple.Numbers':'com.apple.iWork.Numbers');if(app.running()){numbers=app;break;}}catch(_){}}
  if(!numbers||!numbers.documents.length)return JSON.stringify({status:'stale'});
  var doc=numbers.documents[0],sheet=doc.activeSheet;
  if(doc.id()!==target.documentId||String(sheet.name())!==target.sheet||sheet.tables.length<=target.tableId)return JSON.stringify({status:'stale'});
  var table=sheet.tables[target.tableId];
  if(String(table.name())!==target.table)return JSON.stringify({status:'stale'});
  if(target.mode==='focus'){table.selectionRange=table.ranges.byName(target.address);numbers.activate();}
  else {var selected=String(table.selectionRange.name()).replace(/\$/g,'');var single=/^([A-Z]+[1-9][0-9]*)(?::\1)?$/.exec(selected);if(!['check','apply'].includes(target.mode)||!single||single[1]!==target.address)return JSON.stringify({status:'stale',stage:'selection'});}
  var cell=table.cells.byName(target.address),value=cell.formattedValue();
  if(target.mode==='apply'){
   ObjC.import('Foundation');
   var input=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
   var request=JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input,$.NSUTF8StringEncoding)));
   if(typeof request.expected!=='string'||value!==request.expected||typeof request.replacement!=='string'||request.replacement.length>2000||/^[=+@]/.test(request.replacement))return JSON.stringify({status:'stale'});
   if(String(cell.formula()||'').trim())return JSON.stringify({status:'formula'});
   cell.value=request.replacement;
   return JSON.stringify({status:String(cell.formattedValue())===request.replacement?'applied':'unavailable'});
  }
  return JSON.stringify({status:'focused',value:value});
 }catch(error){return JSON.stringify({status:Number(error.errorNumber)===-1743?'permission':'unavailable'});}
}
