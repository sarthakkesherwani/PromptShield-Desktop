const {app,BrowserWindow,ipcMain,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {scanSnapshot}=require('./scan.cjs');
const {createMacMonitor}=require('./mac-monitor.cjs');
let win,monitor,watchdog;
function send(data){if(win&&!win.isDestroyed())win.webContents.send('guard-update',data);}
function stop(){if(monitor){monitor.kill();monitor=null;}clearInterval(watchdog);send({status:'paused',reason:'Monitoring paused. Sheet data cleared.'});}
function start(){
 stop();
 if(!['win32','darwin'].includes(process.platform)){send({status:'waiting',reason:'Live monitoring requires macOS or Windows and desktop Microsoft Excel.'});return;}
 const child=process.platform==='darwin' ? createMacMonitor(path.join(app.isPackaged?process.resourcesPath:__dirname,'excel-snapshot-mac.js')) : spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',fs.readFileSync(path.join(__dirname,'excel-watch.ps1'),'utf8')],{windowsHide:true,stdio:['ignore','pipe','ignore']});
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
   try{const snapshot=JSON.parse(line);lastUpdate=Date.now();send(scanSnapshot(snapshot));if(snapshot.status==='permission'){stop();send(snapshot);return;}}
   catch{send({status:'waiting',reason:'Could not inspect this sheet. Monitoring will retry.'});}
  }
 });
 child.on('error',()=>{if(monitor===child){stop();send({status:'waiting',reason:'The Excel adapter could not start.'});}});
 child.on('exit',()=>{if(monitor===child){monitor=null;clearInterval(watchdog);send({status:'waiting',reason:'Excel connection stopped. Press Start to reconnect.'});}});
 watchdog=setInterval(()=>{if(Date.now()-lastUpdate>(process.platform==='darwin'?130000:8000)){stop();send({status:'waiting',reason:'Excel is busy or unavailable. Press Start to reconnect.'});}},2000);
 send({status:'waiting',reason:'Connecting to Excel… On Mac, allow Excel access if macOS asks.'});
}
app.whenReady().then(()=>{
 // The companion serves local files and opens no network listener.
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('devtools:')}));
 win=new BrowserWindow({width:440,height:800,minWidth:350,minHeight:530,alwaysOnTop:true,autoHideMenuBar:true,title:'PromptShield Desktop',backgroundColor:'#f4f3f6',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
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

