const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('eiuPlayer',{
 openLesson:()=>ipcRenderer.invoke('lesson:open'),
 pendingLesson:()=>ipcRenderer.invoke('lesson:pending'),
 onLesson:callback=>{const listener=(_event,lesson)=>callback(lesson);ipcRenderer.on('lesson:opened',listener);return ()=>ipcRenderer.removeListener('lesson:opened',listener);}
});
