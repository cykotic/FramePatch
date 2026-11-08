import {exportArgs} from './export-settings.mjs';
let libraryPromise;
function library() {
  if(!libraryPromise) libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='./vendor/ffmpeg.js';
    script.onload=()=>resolve(window.FFmpegWASM.FFmpeg);
    script.onerror=()=>{libraryPromise=null;script.remove();reject(new Error('Could not load the video encoder. Check your connection and retry.'));};
    document.head.append(script);
  });return libraryPromise;
}
async function blobURL(url,type,signal,onBytes) {
  const response=await fetch(url,{signal});
  if(!response.ok) throw new Error('Could not download the video engine. Check your connection and retry.');
  const total=Number(response.headers.get('content-length'))||0,reader=response.body.getReader(),parts=[];let received=0;
  for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);received+=value.length;onBytes?.(received,total);}
  return URL.createObjectURL(new Blob(parts,{type}));
}
export const transportArgs = [
  '-i', 'input.mov', '-map', '0:v:0', '-map', '0:a:0?',
  '-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb',
  '-c:a', 'aac', '-b:a', '128k', '-f', 'mpegts', '-y', 'output.ts'
];

export async function encodeVideo(file,settings,{signal,onProgress=()=>{},transport=false}={}) {
  const args=transport ? transportArgs : exportArgs(settings);
  const outputPath=transport ? 'output.ts' : 'output.mp4';
  if(file.size>500*1024*1024) throw new Error('This export mode supports files up to 500 MB. Original-quality patching supports larger files.');
  const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
  check();onProgress(0,'Preparing video');
  let inputBytes=new Uint8Array(await file.arrayBuffer());check();
  onProgress(0,'Loading video engine (~31 MB on first use)');
  const FFmpeg=await library();check();const ffmpeg=new FFmpeg();let coreURL,wasmURL;
  const abort=()=>ffmpeg.terminate();signal?.addEventListener('abort',abort,{once:true});
  try {
    const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
    coreURL=await blobURL(base+'/ffmpeg-core.js','text/javascript',signal);
    wasmURL=await blobURL(base+'/ffmpeg-core.wasm','application/wasm',signal,(n,total)=>onProgress(total?Math.min(14,14*n/total):6,`Loading video engine · ${(n/1024/1024).toFixed(1)} MB`));
    check();await ffmpeg.load({coreURL,wasmURL});check();
    URL.revokeObjectURL(coreURL);URL.revokeObjectURL(wasmURL);coreURL=wasmURL=null;
    const started=performance.now();let lastLog='';
    ffmpeg.on('log',({message})=>{lastLog=message;});
    ffmpeg.on('progress',({progress,time})=>onProgress(18+Math.max(0,Math.min(1,progress||0))*76,`${transport ? 'Packaging video' : 'Encoding '+settings.fps+' FPS'} · ${Math.max(0,time/1000000).toFixed(1)} sec processed · ${Math.round((performance.now()-started)/1000)} sec elapsed`));
    onProgress(15,'Reading video into the encoder');await ffmpeg.writeFile('input.mov',inputBytes);inputBytes=null;check();
    onProgress(18,transport?'Packaging video on your device':'Encoding video on your device');const code=await ffmpeg.exec(args);check();
    if(code!==0) {
      const help=transport?'Transport export requires an H.264 source video. ':'Try a lower resolution or smaller clip. ';
      throw new Error('Export failed. '+help+lastLog.slice(0,160));
    }
    onProgress(96,'Preparing download');const bytes=await ffmpeg.readFile(outputPath);check();
    const suffix=transport?'_transport.mp4':`_${settings.fps}fps.mp4`;
    return {blob:new Blob([bytes],{type:transport?'video/mp2t':'video/mp4'}),name:file.name.replace(/\.(mp4|mov)$/i,'')+suffix};
  }catch(error){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');throw error;}
  finally{signal?.removeEventListener('abort',abort);ffmpeg.terminate();if(coreURL)URL.revokeObjectURL(coreURL);if(wasmURL)URL.revokeObjectURL(wasmURL);}
}
