export function exportArgs({fps=60,resolution=1080,quality=18,bitrate=0}={}) {
  fps=Number(fps);resolution=Number(resolution);quality=Number(quality);bitrate=Number(bitrate);
  if(!Number.isFinite(fps)||fps<1||fps>120) throw new Error('Enter a frame rate from 1 to 120 FPS.');
  if(![0,720,1080,1440,2160,4096].includes(resolution)) throw new Error('Choose a supported resolution.');
  if(!Number.isInteger(quality)||quality<16||quality>28) throw new Error('Choose a valid export quality.');
  if(!Number.isFinite(bitrate)||bitrate<0||bitrate>100) throw new Error('Enter a bitrate up to 100 Mbps, or leave it blank for automatic.');
  const filters=[];
  if(resolution) {
    const long=resolution===4096?4096:Math.round(resolution*16/9), short=resolution===4096?4096:resolution;
    filters.push(`scale=w='if(gte(iw,ih),${long},${short})':h='if(gte(iw,ih),${short},${long})':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos`);
  } else filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  filters.push(`fps=${fps}`);
  const args=['-i','input.mov','-map','0:v:0','-map','0:a:0?','-vf',filters.join(','),'-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p'];
  if(bitrate) args.push('-b:v',`${bitrate}M`,'-maxrate',`${bitrate}M`,'-bufsize',`${bitrate*2}M`);
  else args.push('-crf',String(quality));
  args.push('-c:a','aac','-b:a','192k','-map_metadata','-1','-movflags','+faststart','-y','output.mp4');return args;
}
