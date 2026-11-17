const {app,BrowserWindow,ipcMain,session,screen,nativeTheme,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const {scanSnapshot}=require('./scan.cjs');
const {createBulkPlan,summarizePlan,runBulk}=require('./bulk-review.cjs');
const {createMacMonitor}=require('./mac-monitor.cjs');
const {resolveSource}=require('./monitor-source.cjs');
const {createTargets,focusTarget,positionHint,applyTarget,digest}=require('./cell-review.cjs');
let win,monitor,watchdog,hint,cellOutline,hintTimer,hintTarget,hintApplying=false,latestResult,targets=new Map(),revision=0,reviewEpoch=0,manualReviewing=false,dismissedHintKey=null;
let latestSnapshot,bulkPlan,undoBatch,bulkRunning=false,bulkCancelled=false,bulkEpoch=0;
function bulkUpdate(data){if(win&&!win.isDestroyed())win.webContents.send('bulk-update',data);}
const resource=name=>path.join(app.isPackaged?process.resourcesPath:__dirname,name);
const mainSender=event=>win&&!win.isDestroyed()&&event.sender===win.webContents;
function send(data){if(win&&!win.isDestroyed())win.webContents.send('guard-update',data);}
function hideHint(){reviewEpoch++;clearInterval(hintTimer);hintTarget=null;if(hint&&!hint.isDestroyed())hint.close();hint=null;if(cellOutline&&!cellOutline.isDestroyed())cellOutline.close();cellOutline=null;}
function disconnect(){if(monitor){monitor.kill();monitor=null;}clearInterval(watchdog);}
function stop(){bulkCancelled=true;bulkEpoch++;bulkPlan=null;undoBatch=null;latestSnapshot=null;bulkUpdate({phase:'idle',canUndo:false});disconnect();hideHint();latestResult=null;targets.clear();send({status:'paused',reason:'Monitoring paused. Sheet data cleared.'});}
function start(source='excel'){
 stop();let config;
 try{config=resolveSource(process.platform,source);}catch(error){send({status:'waiting',reason:error.message});return;}
 const child=process.platform==='darwin'?createMacMonitor(resource(config.script),{sourceLabel:config.label}):spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',fs.readFileSync(path.join(__dirname,'excel-watch.ps1'),'utf8')],{windowsHide:true,stdio:['ignore','pipe','ignore']});
 monitor=child;let buffer='',lastUpdate=Date.now();child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{
  if(monitor!==child)return;buffer+=chunk;
  if(buffer.length>8000000){stop();send({status:'limited',reason:'Scan limit reached. Restart monitoring.'});return;}
  let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line)continue;
   try{
    const snapshot=JSON.parse(line);
    if(bulkRunning){lastUpdate=Date.now();continue;}
    if(latestResult&&snapshot.status==='waiting'&&snapshot.reason?.startsWith('Reading the active')){send({...latestResult,refreshing:true,monitoring:true});continue;}
    lastUpdate=Date.now();const result=scanSnapshot(snapshot);result.revision=++revision;result.monitoring=true;
    latestSnapshot=snapshot.status==='snapshot'?snapshot:null;latestResult=snapshot.status==='snapshot'?result:null;targets=createTargets(snapshot,result);send(result);if(snapshot.status==='snapshot')automaticHint(snapshot);
    if(snapshot.status==='permission'){disconnect();send({...result,monitoring:false});return;}
   }catch{latestSnapshot=null;latestResult=null;targets.clear();send({status:'waiting',reason:'Could not inspect this sheet. Monitoring will retry.'});}
  }
 });
 child.on('error',()=>{if(monitor===child){stop();send({status:'waiting',reason:'The spreadsheet adapter could not start.'});}});
 child.on('exit',()=>{if(monitor===child){stop();send({status:'waiting',reason:'Spreadsheet connection stopped. Press Start to reconnect.'});}});
 watchdog=setInterval(()=>{if(bulkRunning)return;if(Date.now()-lastUpdate>(process.platform==='darwin'&&!latestResult?130000:8000)){stop();send({status:'waiting',reason:'The spreadsheet app is busy or unavailable. Press Start to reconnect.'});}},2000);
 send({status:'waiting',monitoring:true,reason:`Connecting to ${config.label}… Allow access if macOS asks.`});
}
let anchorModule;
async function nativeAnchor(){
 try{
  if(!anchorModule)anchorModule=require(app.isPackaged?resource('cell-anchor.node'):path.join(__dirname,'../native/cell-anchor.node'));
  for(let attempt=0;attempt<4;attempt++){
   const value=anchorModule.anchor();if(value.status!=='unavailable')return value;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  return {status:'unavailable'};
 }catch{return {status:'unavailable'};}
}
function hintBounds(rect){const anchor=rect.status==='anchor'?rect:win.getBounds();return positionHint(anchor,screen.getDisplayMatching(anchor).workArea,360,272);}
function updateOutline(rect,epoch){
 if(rect.status!=='anchor'){if(cellOutline&&!cellOutline.isDestroyed())cellOutline.hide();return;}
 const bounds={x:Math.round(rect.x-3),y:Math.round(rect.y-3),width:Math.max(8,Math.round(rect.width+6)),height:Math.max(8,Math.round(rect.height+6))};
 if(cellOutline&&!cellOutline.isDestroyed()){cellOutline.setBounds(bounds);cellOutline.showInactive();return;}
 const outline=cellOutline=new BrowserWindow({...bounds,frame:false,transparent:true,resizable:false,focusable:false,alwaysOnTop:true,show:false,skipTaskbar:true,hasShadow:false,backgroundColor:'#00000000',title:'PromptShield red cell highlight',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 outline.setIgnoreMouseEvents(true);outline.webContents.setWindowOpenHandler(()=>({action:'deny'}));outline.webContents.on('will-navigate',event=>event.preventDefault());
 outline.once('ready-to-show',()=>{if(!outline.isDestroyed()&&epoch===reviewEpoch)outline.showInactive();});outline.loadFile(path.join(__dirname,'highlight.html'));
}
async function showCellHint(target,epoch,original){
 const rect=await nativeAnchor();
 if(epoch!==reviewEpoch)return {status:'stale',reason:'Review cancelled.'};
 if(rect.status==='background')return {status:'focused',reason:'Cell selected. Return to Numbers to see the suggestion.'};
 const bounds=hintBounds(rect);if(!bounds)return {status:'unavailable',reason:'Could not place the suggestion.'};
 hint=new BrowserWindow({...bounds,frame:false,transparent:true,resizable:false,alwaysOnTop:true,show:false,skipTaskbar:true,title:'PromptShield cell suggestion',backgroundColor:'#00000000',...(process.platform==='darwin'?{vibrancy:'popover',visualEffectState:'active'}:{}),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 updateOutline(rect,epoch);hintTarget=target;
 const popup=hint;popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));popup.webContents.on('will-navigate',event=>event.preventDefault());
 popup.webContents.once('did-finish-load',()=>{if(popup.isDestroyed()||epoch!==reviewEpoch)return;popup.webContents.send('cell-hint',{...target.item,side:bounds.x>(rect.x??win.getBounds().x)?'right':'left',anchored:rect.status==='anchor',applied:!!target.applied,original:target.applied?'Masked':target.item.categories.includes('email')?original:'Sensitive value',theme:nativeTheme.shouldUseDarkColors?'dark':'light'});popup.showInactive();});popup.loadFile(path.join(__dirname,'hint.html'));
 let busy=false;hintTimer=setInterval(async()=>{if(busy||hintApplying||popup.isDestroyed())return;busy=true;try{
  const checkedHash=target.hash;const check=await focusTarget(target,resource('focus-numbers-mac.js'),'check');if(hintApplying||checkedHash!==target.hash)return;if(check.status!=='focused'){hideHint();return;}
  const anchor=await nativeAnchor();if(popup.isDestroyed())return;
  if(anchor.status==='background'){popup.hide();if(cellOutline&&!cellOutline.isDestroyed())cellOutline.hide();return;}
  const next=hintBounds(anchor);if(next){popup.setBounds(next);popup.showInactive();updateOutline(anchor,epoch);}
 }catch{hideHint();}finally{busy=false;}},1000);
 const reason=rect.status==='anchor'?'Cell highlighted in Numbers. Use Apply mask in the popup, or copy the replacement.':'Suggestion opened beside the control panel. Exact cell position is unavailable, so no red cell marker is drawn.';
 return {status:'focused',reason:reason+' Monitoring continues.'};
}
async function reviewCell(event,id,scanRevision){
 if(bulkRunning||!mainSender(event)||process.platform!=='darwin'||!latestResult||scanRevision!==latestResult.revision||!Number.isInteger(id)||!targets.has(id))return {status:'stale',reason:'The sheet changed. Scan again before reviewing this cell.'};
 const target=targets.get(id);dismissedHintKey=null;hideHint();const epoch=reviewEpoch;manualReviewing=true;
 try{
  const focused=await focusTarget(target,resource('focus-numbers-mac.js'));
  if(epoch!==reviewEpoch)return {status:'stale',reason:'Review cancelled.'};
  if(focused.status!=='focused')return {status:focused.status,reason:'This cell changed or Numbers is unavailable. Start a fresh scan.'};
  const result=await showCellHint(target,epoch,focused.original);
  if(result.status==='focused'&&hint)autoHintKey=JSON.stringify([target.documentId,target.sheet,target.tableId,target.address,target.hash]);
  return result;
 }catch{return {status:'unavailable',reason:'Could not locate this cell. Keep Numbers open and run a fresh scan.'};}finally{manualReviewing=false;}
}
let inlineEnabled=true,autoBusy=false,autoHintKey=null,accessNotified=false;
async function automaticHint(snapshot){
 if(bulkRunning||!inlineEnabled||manualReviewing||hintApplying||process.platform!=='darwin'||snapshot.source!=='numbers')return;
 const selected=snapshot.selected;
 if(hintTarget?.applied){
  if(selected&&snapshot.documentId===hintTarget.documentId&&snapshot.sheet===hintTarget.sheet&&selected.tableId===hintTarget.tableId&&selected.address===hintTarget.address)return;
  hideHint();autoHintKey=null;
 }
 const target=selected?[...targets.values()].find(t=>t.tableId===selected.tableId&&t.address===selected.address):null;
 if(!target){if(autoHintKey)hideHint();autoHintKey=null;dismissedHintKey=null;return;}
 const key=JSON.stringify([target.documentId,target.sheet,target.tableId,target.address,target.hash]);
 if(key===dismissedHintKey)return;
 if(autoBusy||(key===autoHintKey&&hint&&!hint.isDestroyed()))return;
 autoBusy=true;hideHint();autoHintKey=null;const epoch=reviewEpoch;
 try{
  const focused=await focusTarget(target,resource('focus-numbers-mac.js'),'check');
  if(focused.status!=='focused'||epoch!==reviewEpoch||!monitor)return;
  const result=await showCellHint(target,epoch,focused.original);
  if(result.status==='accessibility'&&!accessNotified){accessNotified=true;if(win&&!win.isDestroyed())win.webContents.send('inline-status',result);}
  if(result.status==='focused'&&hint)autoHintKey=key;
 }catch{}finally{autoBusy=false;}
}
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('devtools:')}));
 const area=screen.getPrimaryDisplay().workArea,width=Math.min(360,area.width),height=Math.min(570,area.height);
 win=new BrowserWindow({width,height,x:area.x+area.width-width,y:area.y,frame:false,transparent:true,resizable:false,maximizable:false,hasShadow:true,show:false,alwaysOnTop:true,autoHideMenuBar:true,title:'PromptShield Desktop',backgroundColor:'#00000000',...(process.platform==='darwin'?{vibrancy:'under-window',visualEffectState:'active'}:{}),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 ipcMain.handle('set-theme',(event,theme)=>{if(mainSender(event)&&(theme==='light'||theme==='dark')){nativeTheme.themeSource=theme;if(hint&&!hint.isDestroyed())hint.webContents.send('hint-theme',theme);}});
 ipcMain.handle('start-monitor',(event,source)=>{if(mainSender(event))start(source);});
 ipcMain.handle('stop-monitor',event=>{if(mainSender(event))stop();});
 ipcMain.handle('close-guard',event=>{if(mainSender(event))app.quit();});
 ipcMain.handle('review-cell',reviewCell);
 ipcMain.handle('inline-hints',(event,enabled)=>{if(mainSender(event)&&typeof enabled==='boolean'){inlineEnabled=enabled;accessNotified=false;if(!enabled)hideHint();}});
 ipcMain.handle('inline-settings',event=>{if(mainSender(event))return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');});
 async function applyCurrentHint(){
  if(bulkRunning||!hint||hint.isDestroyed()||!hintTarget||hintApplying)return {status:'stale',reason:'Select the sensitive cell again.'};
  hintApplying=true;const target=hintTarget,popup=hint,epoch=reviewEpoch;

  try{
   const result=await applyTarget(target,resource('focus-numbers-mac.js'));
   if(epoch!==reviewEpoch||popup.isDestroyed())return {status:'stale',reason:'Selection changed. Scan again.'};
   if(result.status==='applied'){
    target.hash=digest(target.item.preview);target.item.canApply=false;target.applied=true;
    if(win&&!win.isDestroyed())win.webContents.send('inline-status',{status:'applied',reason:`Mask applied to ${target.item.cell}. Monitoring continues.`});
    const applied={status:'applied',reason:'Mask applied to this cell. Monitoring continues.'};popup.webContents.send('mask-applied',applied);return applied;
   }
   return {status:result.status,reason:result.status==='formula'?'This cell contains a formula. Copy the replacement to keep control of the formula.':'The value or selection changed. Run a fresh scan before applying.'};
  }catch{return {status:'unavailable',reason:'Could not apply the mask. The original cell was not confirmed as replaced. Run a fresh scan.'};}finally{hintApplying=false;}
 }
 ipcMain.handle('apply-hint',event=>{if(hint&&!hint.isDestroyed()&&event.sender===hint.webContents)return applyCurrentHint();return {status:'stale',reason:'Select the cell again.'};});
 ipcMain.handle('apply-cell',async(event,id,scanRevision)=>{
  const reviewed=await reviewCell(event,id,scanRevision);
  if(reviewed.status!=='focused')return reviewed;
  return applyCurrentHint();
 });
 ipcMain.handle('prepare-bulk',event=>{
  if(!mainSender(event)||bulkRunning||hintApplying||process.platform!=='darwin'||!latestSnapshot)return {status:'unavailable',reason:'Run a Numbers scan first.'};
  try{bulkPlan=createBulkPlan(latestSnapshot);return {status:'ready',...summarizePlan(bulkPlan)};}catch{return {status:'unavailable',reason:'Keep the Numbers sheet open and run a fresh scan.'};}
 });
 async function performBulk(plan,isUndo=false){
  if(bulkRunning||hintApplying)return {status:'busy',reason:'A masking action is already running.'};
  if(!latestSnapshot||latestSnapshot.documentId!==plan.documentId||latestSnapshot.sheet!==plan.sheet)return {status:'stale',reason:'Return to the reviewed Numbers sheet, then try again.'};
  const epoch=bulkEpoch;bulkRunning=true;bulkCancelled=false;hideHint();
  bulkUpdate({phase:'running',action:isUndo?'undo':'mask',total:plan.entries.length,processed:0,applied:0,skipped:0,canUndo:false});
  try{
   const result=await runBulk(plan,resource('bulk-numbers-mac.js'),{cancelled:()=>bulkCancelled||epoch!==bulkEpoch,onProgress:progress=>{if(epoch===bulkEpoch)bulkUpdate({phase:'running',action:isUndo?'undo':'mask',...progress});}});
   if(epoch!==bulkEpoch)return {status:'cancelled',reason:'Remaining changes cancelled.'};
   undoBatch=!isUndo&&result.undo.length?{documentId:plan.documentId,sheet:plan.sheet,entries:result.undo}:null;bulkPlan=null;
   const verb=isUndo?'restored':'masked';const reason=`${result.applied} cells ${verb}. ${result.skipped} skipped. ${result.remaining} remaining.`+(result.unconfirmed?` ${result.unconfirmed} could not be confirmed. Scan again.`:' Monitoring continues.');
   const summary={status:result.status,reason,applied:result.applied,skipped:result.skipped,remaining:result.remaining,unconfirmed:result.unconfirmed};
   bulkUpdate({phase:'done',...summary,canUndo:!!undoBatch});return summary;
  }finally{bulkRunning=false;}
 }
 ipcMain.handle('apply-bulk',(event,id)=>{
  if(!mainSender(event)||!bulkPlan||id!==bulkPlan.id)return {status:'stale',reason:'Review the sheet again before applying.'};
  return performBulk(bulkPlan);
 });
 ipcMain.handle('cancel-bulk',event=>{if(mainSender(event)){bulkCancelled=true;bulkPlan=null;}});
 ipcMain.handle('undo-bulk',event=>{
  if(!mainSender(event)||!undoBatch)return {status:'stale',reason:'No batch is available to undo.'};
  return performBulk(undoBatch,true);
 });
 ipcMain.handle('dismiss-hint',event=>{if(hint&&!hint.isDestroyed()&&event.sender===hint.webContents){if(hintTarget)dismissedHintKey=JSON.stringify([hintTarget.documentId,hintTarget.sheet,hintTarget.tableId,hintTarget.address,hintTarget.hash]);hideHint();}});
 win.once('ready-to-show',()=>win.show());win.loadFile(path.join(__dirname,'index.html'));
 win.on('closed',()=>{stop();win=null;});
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',stop);
