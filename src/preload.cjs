const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('guard',{
 start:()=>ipcRenderer.invoke('start-monitor'),
 stop:()=>ipcRenderer.invoke('stop-monitor'),
 close:()=>ipcRenderer.invoke('close-guard'),
 onUpdate:callback=>ipcRenderer.on('guard-update',(_event,data)=>callback(data)),
});
