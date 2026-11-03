const containers = new Set(['moov','trak','mdia','minf','stbl']);
const decoder = new TextDecoder('latin1');
const encoder = new TextEncoder();
const fail = message => { throw new Error(message); };
function number64(view, offset) {
  const n = view.getBigUint64(offset);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) fail('This file is too large to process safely.');
  return Number(n);
}
export function boxes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), list=[];
  for(let pos=0;pos<bytes.length;) {
    if(pos+8>bytes.length) fail('The video has an incomplete container header.');
    let size=view.getUint32(pos), header=8;
    const type=decoder.decode(bytes.subarray(pos+4,pos+8));
    if(size===1) { if(pos+16>bytes.length) fail('Incomplete extended header.'); size=number64(view,pos+8); header=16; }
    else if(size===0) size=bytes.length-pos;
    if(size<header || pos+size>bytes.length) fail('The video has an invalid container structure.');
    list.push({pos,size,type,header}); pos+=size;
  }
  return list;
}
function concat(parts) {
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let at=0;
  for(const p of parts) { out.set(p,at); at+=p.length; } return out;
}
function box(type,payload) {
  if(payload.length+8>=2**32) fail('The movie index is too large.');
  const out=new Uint8Array(payload.length+8);
  new DataView(out.buffer).setUint32(0,out.length);out.set(encoder.encode(type),4);out.set(payload,8);return out;
}
function rewrite(bytes,relocate,unspecified,path=[]) {
  const parts=[];
  for(const {pos,size,type,header} of boxes(bytes)) {
    let p=bytes.slice(pos+header,pos+size);
    if(['cmov','mvex'].includes(type)) fail('Fragmented or compressed movie headers are not supported. Export a standard MP4 first.');
    if(path.length===1 && path[0]==='moov' && type==='udta') continue;
    if(containers.has(type)) p=rewrite(p,relocate,unspecified,[...path,type]);
    else if(type==='mvhd' && unspecified) {
      if(p.length<20) fail('Invalid movie header.');
      if(p[0]===0) {
        const v=new DataView(p.buffer,p.byteOffset,p.byteLength), next=new Uint8Array(p.length+12), nv=new DataView(next.buffer);
        next.set(p.subarray(0,4));next[0]=1;
        nv.setBigUint64(4,BigInt(v.getUint32(4)));nv.setBigUint64(12,BigInt(v.getUint32(8)));
        nv.setUint32(20,v.getUint32(12));nv.setBigUint64(24,0xffffffffffffffffn);next.set(p.subarray(20),32);p=next;
      } else if(p[0]===1 && p.length>=32) new DataView(p.buffer,p.byteOffset,p.length).setBigUint64(24,0xffffffffffffffffn);
      else fail('Unsupported movie header version.');
    } else if(['stco','co64'].includes(type) && relocate) {
      if(p.length<8) fail('Invalid video chunk table.');
      const v=new DataView(p.buffer,p.byteOffset,p.length), count=v.getUint32(4), width=type==='stco'?4:8;
      if(p.length!==8+count*width) fail('Invalid video chunk table length.');
      for(let i=0;i<count;i++) {
        const at=8+i*width, old=width===4?v.getUint32(at):number64(v,at), value=relocate(old);
        if(width===4) { if(value>=2**32) fail('This video needs 64-bit offsets. Try the desktop tool.'); v.setUint32(at,value); }
        else v.setBigUint64(at,BigInt(value));
      }
    }
    parts.push(box(type,p));
  }
  return concat(parts);
}
export async function patchVideo(file,{unspecified=true,onProgress=()=>{},signal}={}) {
  const check=()=>{if(signal?.aborted) throw new DOMException('Cancelled','AbortError');};
  check();onProgress(5,'Reading video container');
  const layout=[];
  for(let pos=0;pos<file.size;) {
    check();const raw=new Uint8Array(await file.slice(pos,pos+16).arrayBuffer());
    if(raw.length<8) fail('This is not a complete MP4 or MOV file.');
    const v=new DataView(raw.buffer);let size=v.getUint32(0),header=8;
    const type=decoder.decode(raw.subarray(4,8));
    if(size===1) {if(raw.length<16) fail('Incomplete file header.');size=number64(v,8);header=16;}
    else if(size===0) size=file.size-pos;
    if(size<header || pos+size>file.size) fail('This file is not a valid MP4 or MOV container.');
    layout.push({pos,size,type,header});pos+=size;
    if(layout.length>100000) fail('Too many container boxes.');
  }
  if(layout.some(b=>['moof','sidx','mfra'].includes(b.type))) fail('Fragmented MP4 is not supported. Export a standard MP4 first.');
  const movies=layout.filter(b=>b.type==='moov');
  if(movies.length!==1 || !layout.some(b=>b.type==='mdat')) fail('Choose a standard, self-contained MP4 or MOV video.');
  const movie=movies[0];
  if(movie.size>64*1024*1024) fail('This movie index is too large for browser patching. Use the desktop tool.');
  const raw=new Uint8Array(await file.slice(movie.pos,movie.pos+movie.size).arrayBuffer());
  check();onProgress(40,'Patching movie header');
  let updated=rewrite(raw,null,unspecified);
  const rest=layout.filter(b=>b!==movie),prefix=[];
  while(rest.length && ['ftyp','free','wide'].includes(rest[0].type)) prefix.push(rest.shift());
  const order=[...prefix,null,...rest],shifts=[];let position=0;
  for(const b of order) {
    if(!b) position+=updated.length;
    else {shifts.push({low:b.pos,high:b.pos+b.size,delta:position-b.pos});position+=b.size;}
  }
  updated=rewrite(raw,offset=>{
    const shift=shifts.find(s=>offset>=s.low && offset<s.high);
    if(!shift) fail('The video references media outside this file.');return offset+shift.delta;
  },unspecified);
  check();onProgress(80,'Preparing your download');
  const blob=new Blob(order.map(b=>b?file.slice(b.pos,b.pos+b.size):updated),{type:'video/mp4'});
  check();onProgress(100,'Your video is ready');
  return {blob,name:file.name.replace(/\.(mp4|mov)$/i,'')+'_patched.mp4'};
}
