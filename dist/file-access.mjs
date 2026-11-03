// Read the provider-backed File while its picker permission is fresh. A Blob
// assembled from byte chunks no longer depends on the phone's content provider.
export async function captureVideo(source,{signal,onProgress=()=>{}}={}) {
  const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
  check();const chunks=[];let received=0;
  const reader=source.stream().getReader();
  const abort=()=>{reader.cancel().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    for(;;) {
      check();const {done,value}=await reader.read();check();
      if(done)break;
      chunks.push(value);received+=value.byteLength;
      onProgress(received,source.size);
    }
    if(received!==source.size)throw new DOMException('Incomplete video read','NotReadableError');
    const copy=new Blob(chunks,{type:source.type||'video/mp4'});
    copy.name=source.name;return copy;
  }finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
}
export function fileAccessMessage(error) {
  if(['NotReadableError','NotAllowedError','SecurityError','NotFoundError'].includes(error?.name))
    return 'Your browser could not read this video. Save it to your phone’s Downloads folder, then choose that local copy using Choose video. Files selected directly from cloud storage or another app may lose access.';
  return error?.message||'Could not open this video. Choose it again.';
}
