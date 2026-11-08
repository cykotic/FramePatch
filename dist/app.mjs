import {patchVideo} from './patcher.mjs';
import {encodeVideo} from './encoder.mjs';
import {exportArgs} from './export-settings.mjs';
import {captureVideo,fileAccessMessage} from './file-access.mjs';
const $=id=>document.getElementById(id);
let file=null,inputURL=null,resultURL=null,controller=null,busy=false,selectionController=null,selectionId=0;
const size=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GB':(n/1024**2).toFixed(1)+' MB';
const controls=()=>[...document.querySelectorAll('#options select,#options input,#options button')];
function revoke(){if(inputURL)URL.revokeObjectURL(inputURL);if(resultURL)URL.revokeObjectURL(resultURL);inputURL=resultURL=null;}
function settings(){return {fps:Number($('fps').value),resolution:Number($('resolution').value),quality:Number($('quality').value),bitrate:Number($('bitrate').value)};}
function sync(){const mode=$('export-mode').value;$('custom-settings').hidden=mode!=='custom';$('transport-note').hidden=mode!=='transport';$('patch-label').textContent=mode!=='original'?'Export video':'Patch video';$('fps-note').textContent=Number($('fps').value)>60?'Above TikTok’s documented 60 FPS limit. Extra frames repeat existing frames; this does not add new motion detail.':'Changing frame rate duplicates or drops frames; playback speed and audio timing stay the same.';$('quality-label').textContent=Number($('quality').value)<=18?'Maximum':Number($('quality').value)<=23?'High':'Smaller file';$('quality').disabled=busy||Number($('bitrate').value)>0;}
function reset(){selectionId++;selectionController?.abort();controller?.abort();revoke();file=null;$('file').value='';$('preview').pause();$('preview').removeAttribute('src');$('preview').load();for(const id of ['selected','preview','result','progress-area'])$(id).hidden=true;$('drop').hidden=false;$('patch').hidden=false;$('patch').disabled=true;$('options').hidden=false;$('remove').disabled=false;$('message').textContent='';sync();}
async function choose(candidate){
 if(!candidate||busy)return;reset();
 if(!/\.(mp4|mov)$/i.test(candidate.name)){$('message').textContent='Choose an MP4 or MOV video.';return;}
 if(!candidate.size){$('message').textContent='This file is empty. Choose another video.';return;}
 const id=selectionId;selectionController=new AbortController();
 $('filename').textContent=candidate.name;$('filemeta').textContent='Reading video…';
 $('drop').hidden=true;$('selected').hidden=false;$('patch').disabled=true;
 try{
  const captured=await captureVideo(candidate,{signal:selectionController.signal,onProgress:(n,total)=>{if(id===selectionId)$('filemeta').textContent=`Reading video · ${Math.round(n/total*100)}%`;}});
  if(id!==selectionId)return;
  file=captured;$('filemeta').textContent=size(file.size)+' · Ready on this device';
  $('preview').hidden=false;inputURL=URL.createObjectURL(file);$('preview').src=inputURL;$('patch').disabled=false;
 }catch(error){
  if(id!==selectionId)return;
  reset();$('message').textContent=error.name==='AbortError'?'Video selection cancelled.':fileAccessMessage(error);
 }
}
$('drop').onclick=()=>$('file').click();$('file').onchange=e=>choose(e.target.files[0]);
for(const type of ['dragenter','dragover'])$('drop').addEventListener(type,e=>{e.preventDefault();$('drop').classList.add('drag');});
for(const type of ['dragleave','drop'])$('drop').addEventListener(type,e=>{e.preventDefault();$('drop').classList.remove('drag');});
$('drop').addEventListener('drop',e=>choose(e.dataTransfer.files[0]));document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('remove').onclick=reset;$('another').onclick=reset;
$('preview').addEventListener('loadedmetadata',()=>{if(file){const v=$('preview');$('filemeta').textContent=size(file.size)+' · '+v.videoWidth+' × '+v.videoHeight+(Number.isFinite(v.duration)?' · '+Math.round(v.duration)+' sec':'');}});
for(const id of ['export-mode','fps','quality','bitrate'])$(id).addEventListener('input',sync);
for(const [id,resolution] of [['preset-hd',1080],['preset-max',4096]])$(id).onclick=()=>{$('export-mode').value='custom';$('resolution').value=String(resolution);$('fps').value='60';$('quality').value='18';$('bitrate').value='';sync();};
$('patch').onclick=async()=>{
 if(!file||busy)return;const mode=$('export-mode').value,custom=mode==='custom',transport=mode==='transport',config=settings();$('message').textContent='';
 if(custom){try{exportArgs(config);}catch(e){$('message').textContent=e.message;return;}}
 busy=true;controller=new AbortController();$('preview').pause();$('patch').disabled=true;$('remove').disabled=true;controls().forEach(c=>c.disabled=true);$('progress-area').hidden=false;
 const progress=(n,label)=>{$('bar').style.width=n+'%';$('progress-label').textContent=label;};
 try{
  let result;
  if(custom){const encoded=await encodeVideo(file,config,{signal:controller.signal,onProgress:progress});const output=encoded.blob;output.name=encoded.name;result=await patchVideo(output,{unspecified:false,signal:controller.signal,onProgress:(n)=>progress(97+n*.03,'Finishing MP4 container')});result.name=encoded.name;}
  else if(transport)result=await encodeVideo(file,config,{transport:true,signal:controller.signal,onProgress:progress});
  else result=await patchVideo(file,{signal:controller.signal,onProgress:progress});
  resultURL=URL.createObjectURL(result.blob);$('download').href=resultURL;$('download').download=result.name;$('result-note').textContent=transport?'Original H.264 video · MPEG transport stream · AAC audio when present':custom?`${config.fps} FPS · H.264 MP4 · ${size(result.blob.size)} · audio included when present`:'Original video and audio preserved without re-encoding.';$('result').hidden=false;$('patch').hidden=true;$('options').hidden=true;$('progress-area').hidden=true;
 }catch(error){$('message').textContent=error.name==='AbortError'?'Cancelled. Your original file is unchanged.':fileAccessMessage(error);$('patch').disabled=false;$('progress-area').hidden=true;}
 finally{busy=false;$('remove').disabled=false;controls().forEach(c=>c.disabled=false);sync();}
};
$('cancel').onclick=()=>controller?.abort();sync();
