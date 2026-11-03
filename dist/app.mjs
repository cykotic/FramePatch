import {patchVideo} from './patcher.mjs';
const $=id=>document.getElementById(id);
let file=null,inputURL=null,resultURL=null,controller=null;
const size=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GB':(n/1024**2).toFixed(1)+' MB';
function revoke(){if(inputURL)URL.revokeObjectURL(inputURL);if(resultURL)URL.revokeObjectURL(resultURL);inputURL=resultURL=null;}
function reset(){controller?.abort();revoke();file=null;$('file').value='';$('preview').pause();$('preview').removeAttribute('src');$('preview').load();for(const id of ['selected','preview','result','progress-area'])$(id).hidden=true;$('drop').hidden=false;$('patch').hidden=false;$('patch').disabled=true;$('options').hidden=false;$('mode').disabled=false;$('remove').disabled=false;$('message').textContent='';}
function choose(candidate){
  if(!candidate)return;reset();
  if(!/\.(mp4|mov)$/i.test(candidate.name)){$('message').textContent='Choose an MP4 or MOV video.';return;}
  if(candidate.size===0){$('message').textContent='This file is empty. Choose another video.';return;}
  file=candidate;$('filename').textContent=file.name;$('filemeta').textContent=size(file.size)+' · '+file.name.split('.').pop().toUpperCase();
  $('drop').hidden=true;$('selected').hidden=false;$('preview').hidden=false;inputURL=URL.createObjectURL(file);$('preview').src=inputURL;$('patch').disabled=false;
}
$('drop').onclick=()=>$('file').click();$('file').onchange=e=>choose(e.target.files[0]);
for(const type of ['dragenter','dragover'])$('drop').addEventListener(type,e=>{e.preventDefault();$('drop').classList.add('drag');});
for(const type of ['dragleave','drop'])$('drop').addEventListener(type,e=>{e.preventDefault();$('drop').classList.remove('drag');});
$('drop').addEventListener('drop',e=>choose(e.dataTransfer.files[0]));
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('remove').onclick=reset;$('another').onclick=reset;
$('preview').addEventListener('loadedmetadata',()=>{if(file){const v=$('preview');$('filemeta').textContent=size(file.size)+' · '+v.videoWidth+' × '+v.videoHeight+(Number.isFinite(v.duration)?' · '+Math.round(v.duration)+' sec':'');}});
$('patch').onclick=async()=>{
  if(!file)return;controller=new AbortController();$('message').textContent='';$('patch').disabled=true;$('remove').disabled=true;$('mode').disabled=true;$('progress-area').hidden=false;
  try{
    const result=await patchVideo(file,{unspecified:$('mode').checked,signal:controller.signal,onProgress:(n,label)=>{$('bar').style.width=n+'%';$('progress-label').textContent=label;}});
    resultURL=URL.createObjectURL(result.blob);$('download').href=resultURL;$('download').download=result.name;$('result').hidden=false;$('patch').hidden=true;$('options').hidden=true;$('progress-area').hidden=true;
  }catch(error){$('message').textContent=error.name==='AbortError'?'Patching cancelled. Your original is unchanged.':error.message;$('patch').disabled=false;$('progress-area').hidden=true;}
  finally{$('remove').disabled=false;$('mode').disabled=false;}
};
$('cancel').onclick=()=>controller?.abort();

