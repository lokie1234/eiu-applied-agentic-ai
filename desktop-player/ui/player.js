/* global EIU_PLAYER_ASSETS, createTsxDocument */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let code='',name='',page=1,total=0,zoom=1,loadVersion=0,requestId='',readyTimer;
 let frame=null,dragDepth=0;
 const notice=message=>{$('notice').textContent=message||'';};
 function scale(){
  if(!frame)return;
  const width=$('canvas').clientWidth,height=$('canvas').clientHeight;
  $('slide-mount').style.width=width*zoom+'px';
  $('slide-mount').style.height=height*zoom+'px';
 }
 function controls(){
  $('page').value=page;$('page').max=total;$('total').textContent='/ '+total;
  $('previous').disabled=page<=1;$('next').disabled=page>=total;
  $('zoom-label').textContent=Math.round(zoom*100)+'%';
  $('lesson-status').textContent=total+' slide · Bài học tương tác';
 }
 function render(){
  if(!code)return;
  clearTimeout(readyTimer);requestId=crypto.randomUUID();
  $('loading').hidden=false;
  frame=document.createElement('iframe');frame.className='lesson-frame';
  frame.title=name+' · slide '+page;
  frame.setAttribute('sandbox','allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox');
  frame.srcdoc=createTsxDocument(code,page,$('template').checked?EIU_PLAYER_ASSETS.template:'','eiu-business-v1',requestId,true);
  $('slide-mount').replaceChildren(frame);scale();controls();
  readyTimer=setTimeout(()=>{notice('Bài học chưa phản hồi. Hãy kiểm tra tệp JS hoặc mở lại bài học.');$('loading').hidden=true;},15000);
 }
 function navigate(next){if(!total)return;const target=Math.min(total,Math.max(1,Math.round(next)));if(target!==page){page=target;render();}else controls();}
 async function openLesson(lesson){
  if(!lesson)return;
  if(!/\.js$/i.test(lesson.name)||!lesson.code?.trim())throw Error('Chọn tệp bài học JS có nội dung.');
  if(new TextEncoder().encode(lesson.code).length>50*1024*1024)throw Error('Tệp vượt quá 50 MB.');
  if(!/\bexports\s*(?:\.\s*(?:default|slides)\b|\[\s*["'](?:default|slides)["']\s*\])/.test(lesson.code))throw Error('Tệp này chưa ở dạng bài học JS. Hãy tải bản JS từ Learning Space.');
  code=lesson.code;name=lesson.name;page=1;total=0;zoom=1;
  $('file-name').textContent=name;$('heading').textContent='Bài học của bạn, trong không gian EIU.';
  $('lesson-name').textContent=name;$('welcome').hidden=true;$('viewer').hidden=false;
  notice('');render();
 }
 async function choose(){
  try{if(window.eiuPlayer)await openLesson(await window.eiuPlayer.openLesson());else $('file-input').click();}catch(error){notice(error.message);}
 }
 $('open').addEventListener('click',choose);$('choose').addEventListener('click',choose);
 $('file-input').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const version=++loadVersion;try{if(file.size>50*1024*1024)throw Error('Tệp vượt quá 50 MB.');const text=await file.text();if(version===loadVersion)await openLesson({name:file.name,code:text});}catch(error){notice(error.message);}event.target.value='';});
 $('previous').addEventListener('click',()=>navigate(page-1));$('next').addEventListener('click',()=>navigate(page+1));
 $('page').addEventListener('change',event=>{const value=Number(event.target.value);if(Number.isFinite(value))navigate(value);});
 $('template').addEventListener('change',render);
 function setZoom(value){zoom=Math.min(2,Math.max(.5,value));scale();controls();}
 $('zoom-in').addEventListener('click',()=>setZoom(zoom+.1));$('zoom-out').addEventListener('click',()=>setZoom(zoom-.1));$('fit').addEventListener('click',()=>setZoom(1));
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(error){notice(error.message);}});
 document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('presentation',Boolean(document.fullscreenElement)&&Boolean(code));scale();});
 window.addEventListener('resize',scale);
 window.addEventListener('message',event=>{
  if(event.source!==frame?.contentWindow||event.data?.requestId!==requestId)return;
  const payload=event.data;
  if(payload.type==='eiu-tsx-ready'){
   if(!Number.isSafeInteger(payload.slides)||payload.slides<1||payload.slides>10000){notice('Bài học không chứa slide hợp lệ.');return;}
   total=payload.slides;clearTimeout(readyTimer);$('loading').hidden=true;controls();
  }else if(payload.type==='eiu-tsx-error'){clearTimeout(readyTimer);$('loading').hidden=true;notice('Không thể hiển thị bài học. Kiểm tra bản JS xuất từ Learning Space.');}
  else if(payload.type==='eiu-lesson-navigate')navigate(page+payload.delta);
 });
 window.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='o'){event.preventDefault();void choose();return;}
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(['ArrowRight','PageDown'].includes(event.key)){event.preventDefault();navigate(page+1);}
  if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();navigate(page-1);}
 });
 document.addEventListener('dragenter',event=>{if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();dragDepth++;$('drop-overlay').hidden=false;});
 document.addEventListener('dragover',event=>{event.preventDefault();});
 document.addEventListener('dragleave',event=>{event.preventDefault();if(--dragDepth<=0){dragDepth=0;$('drop-overlay').hidden=true;}});
 document.addEventListener('drop',async event=>{
  event.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;
  const file=event.dataTransfer.files[0];if(!file)return;
  const version=++loadVersion;
  try{if(file.size>50*1024*1024)throw Error('Tệp vượt quá 50 MB.');const text=await file.text();if(version===loadVersion)await openLesson({name:file.name,code:text});}catch(error){notice(error.message);}
 });
 if(window.eiuPlayer){window.eiuPlayer.onLesson(lesson=>openLesson(lesson).catch(error=>notice(error.message)));void window.eiuPlayer.pendingLesson().then(openLesson).catch(error=>notice(error.message));}
})();
