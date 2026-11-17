const {app,BrowserWindow,ipcMain,session,screen,nativeTheme,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const {scanSnapshot}=require('./scan.cjs');
const {createMacMonitor}=require('./mac-monitor.cjs');
const {resolveSource}=require('./monitor-source.cjs');
const {createTargets,focusTarget,positionHint,runFile}=require('./cell-review.cjs');
let win,monitor,watchdog,hint,hintTimer,hintExpiry,latestResult,targets=new Map(),revision=0,reviewEpoch=0;
const resource=name=>path.join(app.isPackaged?process.resourcesPath:__dirname,name);
const mainSender=event=>win&&!win.isDestroyed()&&event.sender===win.webContents;
function send(data){if(win&&!win.isDestroyed())win.webContents.send('guard-update',data);}
function hideHint(){reviewEpoch++;clearInterval(hintTimer);clearTimeout(hintExpiry);if(hint&&!hint.isDestroyed())hint.close();hint=null;}
function disconnect(){if(monitor){monitor.kill();monitor=null;}clearInterval(watchdog);}
function stop(){disconnect();hideHint();latestResult=null;targets.clear();send({status:'paused',reason:'Monitoring paused. Sheet data cleared.'});}
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
    if(latestResult&&snapshot.status==='waiting'&&snapshot.reason?.startsWith('Reading the active')){send({...latestResult,refreshing:true,monitoring:true});continue;}
    lastUpdate=Date.now();const result=scanSnapshot(snapshot);result.revision=++revision;result.monitoring=true;
    latestResult=snapshot.status==='snapshot'?result:null;targets=createTargets(snapshot,result);send(result);if(snapshot.status==='snapshot')automaticHint(snapshot);
    if(snapshot.status==='permission'){disconnect();send({...result,monitoring:false});return;}
   }catch{latestResult=null;targets.clear();send({status:'waiting',reason:'Could not inspect this sheet. Monitoring will retry.'});}
  }
 });
 child.on('error',()=>{if(monitor===child){stop();send({status:'waiting',reason:'The spreadsheet adapter could not start.'});}});
 child.on('exit',()=>{if(monitor===child){stop();send({status:'waiting',reason:'Spreadsheet connection stopped. Press Start to reconnect.'});}});
 watchdog=setInterval(()=>{if(Date.now()-lastUpdate>(process.platform==='darwin'&&!latestResult?130000:8000)){stop();send({status:'waiting',reason:'The spreadsheet app is busy or unavailable. Press Start to reconnect.'});}},2000);
 send({status:'waiting',monitoring:true,reason:`Connecting to ${config.label}… Allow access if macOS asks.`});
}
async function showCellHint(target,epoch,original){
 const helper=app.isPackaged?resource('cell-anchor'):path.join(__dirname,'../native/cell-anchor');
 const rect=await runFile(helper,[]);
 if(epoch!==reviewEpoch)return {status:'stale',reason:'Review cancelled.'};
 if(rect.status==='accessibility')return {status:'accessibility',reason:'To show email → masked value beside a Numbers cell, allow PromptShield Desktop in System Settings → Privacy & Security → Accessibility. Then select the cell again.'};
 if(rect.status!=='anchor')return {status:'focused',reason:'Cell selected. Its position is unavailable; use the suggested replacement in this panel.'};
 const bounds=positionHint(rect,screen.getDisplayMatching({x:rect.x,y:rect.y,width:rect.width,height:rect.height}).workArea,330,220);
 if(!bounds)return {status:'focused',reason:'Cell selected. Review the replacement in this panel.'};
 hint=new BrowserWindow({...bounds,frame:false,transparent:true,resizable:false,alwaysOnTop:true,show:false,skipTaskbar:true,title:'PromptShield cell suggestion',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 const popup=hint;popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));popup.webContents.on('will-navigate',event=>event.preventDefault());
 popup.webContents.once('did-finish-load',()=>{if(popup.isDestroyed()||epoch!==reviewEpoch)return;popup.webContents.send('cell-hint',{...target.item,original:target.item.categories.includes('email')?original:'Sensitive value',theme:nativeTheme.shouldUseDarkColors?'dark':'light'});popup.showInactive();});
 popup.loadFile(path.join(__dirname,'hint.html'));
 let busy=false;hintTimer=setInterval(async()=>{if(busy||popup.isDestroyed())return;busy=true;try{
  const check=await focusTarget(target,resource('focus-numbers-mac.js'),'check');if(check.status!=='focused'){hideHint();return;}
  const anchor=await runFile(helper,[]);if(popup.isDestroyed())return;
  if(anchor.status!=='anchor'){popup.hide();return;}
  const next=positionHint(anchor,screen.getDisplayMatching({x:anchor.x,y:anchor.y,width:anchor.width,height:anchor.height}).workArea,330,220);if(next){popup.setBounds(next);popup.showInactive();}
 }catch{hideHint();}finally{busy=false;}},1000);
 hintExpiry=setTimeout(hideHint,15000);
 return {status:'focused',reason:'Cell highlighted in Numbers. Review the replacement beside it before pasting.'};
}
async function reviewCell(event,id,scanRevision){
 if(!mainSender(event)||process.platform!=='darwin'||!latestResult||scanRevision!==latestResult.revision||!Number.isInteger(id)||!targets.has(id))return {status:'stale',reason:'The sheet changed. Scan again before reviewing this cell.'};
 const target=targets.get(id);disconnect();hideHint();const epoch=reviewEpoch;send({...latestResult,monitoring:false});
 try{
  const focused=await focusTarget(target,resource('focus-numbers-mac.js'));
  if(epoch!==reviewEpoch)return {status:'stale',reason:'Review cancelled.'};
  if(focused.status!=='focused')return {status:focused.status,reason:'This cell changed or Numbers is unavailable. Start a fresh scan.'};
  const result=await showCellHint(target,epoch,focused.original);
  if(result.status==='focused')result.reason+=' Scanning is paused during manual review.';
  return result;
 }catch{return {status:'unavailable',reason:'Could not locate this cell. Keep Numbers open and run a fresh scan.'};}
}
let inlineEnabled=true,autoBusy=false,autoHintKey=null,accessNotified=false;
async function automaticHint(snapshot){
 if(!inlineEnabled||process.platform!=='darwin'||snapshot.source!=='numbers')return;
 const selected=snapshot.selected;
 const target=selected?[...targets.values()].find(t=>t.tableId===selected.tableId&&t.address===selected.address):null;
 if(!target){if(autoHintKey)hideHint();autoHintKey=null;return;}
 const key=JSON.stringify([target.documentId,target.sheet,target.tableId,target.address,target.hash]);
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
 const area=screen.getPrimaryDisplay().workArea,width=Math.min(390,area.width),height=Math.min(650,area.height);
 win=new BrowserWindow({width,height,x:area.x+area.width-width,y:area.y,frame:false,transparent:true,resizable:false,maximizable:false,hasShadow:true,show:false,alwaysOnTop:true,autoHideMenuBar:true,title:'PromptShield Desktop',backgroundColor:'#00000000',...(process.platform==='darwin'?{vibrancy:'under-window',visualEffectState:'active'}:{}),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 ipcMain.handle('set-theme',(event,theme)=>{if(mainSender(event)&&(theme==='light'||theme==='dark'))nativeTheme.themeSource=theme;});
 ipcMain.handle('start-monitor',(event,source)=>{if(mainSender(event))start(source);});
 ipcMain.handle('stop-monitor',event=>{if(mainSender(event))stop();});
 ipcMain.handle('close-guard',event=>{if(mainSender(event))app.quit();});
 ipcMain.handle('review-cell',reviewCell);
 ipcMain.handle('inline-hints',(event,enabled)=>{if(mainSender(event)&&typeof enabled==='boolean'){inlineEnabled=enabled;accessNotified=false;if(!enabled)hideHint();}});
 ipcMain.handle('inline-settings',event=>{if(mainSender(event))return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');});
 ipcMain.handle('dismiss-hint',event=>{if(hint&&!hint.isDestroyed()&&event.sender===hint.webContents)hideHint();});
 win.once('ready-to-show',()=>win.show());win.loadFile(path.join(__dirname,'index.html'));
 win.on('closed',()=>{stop();win=null;});
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',stop);
