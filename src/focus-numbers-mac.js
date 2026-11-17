/* Navigation only: selects a reviewed cell, never changes its value. */
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
  else if(target.mode!=='check'||String(table.selectionRange.name())!==target.address)return JSON.stringify({status:'stale'});
  return JSON.stringify({status:'focused',value:table.cells.byName(target.address).formattedValue()});
 }catch(error){return JSON.stringify({status:Number(error.errorNumber)===-1743?'permission':'unavailable'});}
}
