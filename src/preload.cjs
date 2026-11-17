const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('guard',{
 platform:process.platform,
 setInlineHints:enabled=>ipcRenderer.invoke('inline-hints',enabled),
 onInlineStatus:callback=>ipcRenderer.on('inline-status',(_event,data)=>callback(data)),
 reviewCell:(id,revision)=>ipcRenderer.invoke('review-cell',id,revision),
 openInlineSettings:()=>ipcRenderer.invoke('inline-settings'),
 applyCell:(id,revision)=>ipcRenderer.invoke('apply-cell',id,revision),
 applyHint:()=>ipcRenderer.invoke('apply-hint'),
 dismissHint:()=>ipcRenderer.invoke('dismiss-hint'),
 onMaskApplied:callback=>ipcRenderer.on('mask-applied',(_event,data)=>callback(data)),
 onHintTheme:callback=>ipcRenderer.on('hint-theme',(_event,theme)=>callback(theme)),
 onHint:callback=>ipcRenderer.on('cell-hint',(_event,data)=>callback(data)),
 setTheme:theme=>ipcRenderer.invoke('set-theme',theme),
 start:source=>ipcRenderer.invoke('start-monitor',source),
 stop:()=>ipcRenderer.invoke('stop-monitor'),
 close:()=>ipcRenderer.invoke('close-guard'),
 onUpdate:callback=>ipcRenderer.on('guard-update',(_event,data)=>callback(data)),
});

