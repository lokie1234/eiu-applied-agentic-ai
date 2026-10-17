const { app, BrowserWindow, dialog, ipcMain, protocol, session, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
protocol.registerSchemesAsPrivileged([{scheme:'eiu',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const START='eiu://player/index.html';
let mainWindow, pendingPath;
const isLesson=file=>typeof file==='string' && /\.js$/i.test(file);
const argumentFile=args=>args.slice(app.isPackaged?1:2).find(arg=>isLesson(arg)&&!arg.startsWith('-'));
async function lessonFile(file){
 if(!isLesson(file))throw Error('Chọn tệp bài học .js.');
 const info=await fs.stat(file);
 if(!info.isFile()||!info.size||info.size>50*1024*1024)throw Error('Tệp phải có nội dung và không vượt quá 50 MB.');
 return {name:path.basename(file),code:await fs.readFile(file,'utf8')};
}
function trusted(event){return mainWindow && event.sender===mainWindow.webContents && event.senderFrame===mainWindow.webContents.mainFrame && event.senderFrame.url===START;}
async function openDialog(){
 const result=await dialog.showOpenDialog(mainWindow,{title:'Mở bài học EIU',filters:[{name:'Bài học JavaScript',extensions:['js']}],properties:['openFile']});
 return result.canceled?null:lessonFile(result.filePaths[0]);
}
async function deliver(file){
 if(!mainWindow||mainWindow.webContents.isLoadingMainFrame()){pendingPath=file;return;}
 try{mainWindow.webContents.send('lesson:opened',await lessonFile(file));}
 catch(error){dialog.showErrorBox('Không thể mở bài học',error.message);}
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',(_event,args)=>{mainWindow?.show();mainWindow?.focus();const file=argumentFile(args);if(file)void deliver(file);});
 app.on('open-file',(event,file)=>{event.preventDefault();void deliver(file);});
 app.whenReady().then(async()=>{
  protocol.handle('eiu',async request=>{
   const url=new URL(request.url);
   const pathname=decodeURIComponent(url.pathname);
   const base=path.join(__dirname,'ui');
   const file=path.resolve(base,'.'+pathname);
   if(url.host!=='player'||!file.startsWith(base+path.sep))return new Response('Not found',{status:404});
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.zip':'application/zip'};
   try{return new Response(await fs.readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream'}});}
   catch{return new Response('Not found',{status:404});}
  });
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  function createWindow(){
   mainWindow=new BrowserWindow({show:process.env.EIU_PLAYER_TEST!=='1',width:1440,height:960,minWidth:960,minHeight:640,backgroundColor:'#082945',title:'EIU Lesson Player',icon:path.join(__dirname,'ui/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
   mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==START)event.preventDefault();});
   mainWindow.webContents.setWindowOpenHandler(({url})=>{
    try{const target=new URL(url);if(['https:','http:'].includes(target.protocol))void shell.openExternal(target.href);}catch{}
    return {action:'deny'};
   });
   mainWindow.webContents.on('did-finish-load',()=>{if(pendingPath){const file=pendingPath;pendingPath=undefined;void deliver(file);}});
   mainWindow.on('closed',()=>{mainWindow=null;});
   void mainWindow.loadURL(START);
  }
  ipcMain.handle('lesson:open',event=>{if(!trusted(event))throw Error('Unauthorized frame.');return openDialog();});
  ipcMain.handle('lesson:pending',event=>{if(!trusted(event))throw Error('Unauthorized frame.');const file=pendingPath;pendingPath=undefined;return file?lessonFile(file):null;});
  createWindow();
  const file=argumentFile(process.argv);if(file)void deliver(file);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
   ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
   {label:'Tệp',submenu:[{label:'Mở bài học…',accelerator:'CmdOrCtrl+O',click:async()=>{try{const lesson=await openDialog();if(lesson)mainWindow.webContents.send('lesson:opened',lesson);}catch(error){dialog.showErrorBox('Không thể mở bài học',error.message);}}},{role:'quit'}]},
   {label:'Hiển thị',submenu:[{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]}
  ]));
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
 });
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
