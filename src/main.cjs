const {app,BrowserWindow,ipcMain,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {scanSnapshot}=require('./scan.cjs');
let win,monitor,watchdog;
function send(data){if(win&&!win.isDestroyed())win.webContents.send('guard-update',data);}
function stop(){if(monitor){monitor.kill();monitor=null;}clearInterval(watchdog);send({status:'paused',reason:'Monitoring paused. Sheet data cleared.'});}
function start(){
 stop();
 if(process.platform!=='win32'){send({status:'waiting',reason:'Live monitoring requires Windows and the desktop Microsoft Excel app.'});return;}
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',fs.readFileSync(path.join(__dirname,'excel-watch.ps1'),'utf8')],{windowsHide:true,stdio:['ignore','pipe','ignore']});
 monitor=child;let buffer='',lastUpdate=Date.now();
 child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{
  if(monitor!==child)return;
  buffer+=chunk;
  if(buffer.length>8000000){stop();send({status:'waiting',reason:'Scan limit reached. Restart monitoring.'});return;}
  let end;
  while((end=buffer.indexOf('\n'))>=0){
   const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);
   if(!line)continue;
   try{const snapshot=JSON.parse(line);lastUpdate=Date.now();send(scanSnapshot(snapshot));}
   catch{send({status:'waiting',reason:'Could not inspect this sheet. Monitoring will retry.'});}
  }
 });
 child.on('error',()=>{if(monitor===child){stop();send({status:'waiting',reason:'Windows PowerShell could not start.'});}});
 child.on('exit',()=>{if(monitor===child){monitor=null;clearInterval(watchdog);send({status:'waiting',reason:'Excel connection stopped. Press Start to reconnect.'});}});
 watchdog=setInterval(()=>{if(Date.now()-lastUpdate>8000){stop();send({status:'waiting',reason:'Excel is busy or unavailable. Press Start to reconnect.'});}},2000);
 send({status:'waiting',reason:'Connecting to the active Excel sheet…'});
}
app.whenReady().then(()=>{
 // The companion serves local files and opens no network listener.
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('devtools:')}));
 win=new BrowserWindow({width:390,height:590,minWidth:350,minHeight:380,alwaysOnTop:true,autoHideMenuBar:true,title:'PromptShield Desktop',backgroundColor:'#101816',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.loadFile(path.join(__dirname,'index.html'));
 ipcMain.handle('start-monitor',start);
 ipcMain.handle('stop-monitor',stop);
 ipcMain.handle('close-guard',()=>app.quit());
 win.on('closed',()=>{stop();win=null;});
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',stop);
