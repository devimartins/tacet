import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const check = signal => { if (signal.aborted) throw new Error('Cancelled'); };
export function runProcess(command, args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command,args,{stdio:['ignore','pipe','pipe']}); let stdout='',stderr='';
    const abort=()=>child.kill('SIGKILL'); signal?.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',x=>{stdout+=x;}); child.stderr.on('data',x=>{stderr=(stderr+x).slice(-5000);});
    const timer=setTimeout(()=>child.kill('SIGKILL'),120000);
    child.on('error',reject); child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);code===0?resolve(stdout):reject(new Error(command+' failed: '+stderr));});
  });
}
export async function verifyFile(file, expected, signal) {
  const result = JSON.parse(await runProcess('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],signal));
  const video=result.streams.find(s=>s.codec_type==='video'), audio=result.streams.find(s=>s.codec_type==='audio');
  if (!video || !audio || video.width!==720 || video.height!==1280 || Math.abs(Number(result.format.duration)-expected)>.4) throw new Error('Invalid capture dimensions, tracks or duration');
  // Track existence alone does not prove audible content; verify signal energy too.
  await new Promise((resolve,reject)=>{
    const child=spawn('ffmpeg',['-v','info','-i',file,'-vn','-af','volumedetect','-f','null','-'],{stdio:['ignore','ignore','pipe']});let log='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),30000), abort=()=>child.kill('SIGKILL');signal?.addEventListener('abort',abort,{once:true});
    child.stderr.on('data',x=>{log=(log+x).slice(-10000);});child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);const m=/max_volume: ([-\w.]+) dB/.exec(log);if(code || !m || !Number.isFinite(Number(m[1])) || Number(m[1]) < -60)reject(new Error('Missing or inaudible audio'));else resolve();});
  });
}
export async function capture(job,{rootURL,output}) {
  const { chromium }=await import('playwright'); const signal=job.controller.signal, scene=job.scene;
  const dir=path.join(output,job.id);await mkdir(dir,{recursive:true});
  let browser, recorder, recorderDone, recordingError='', audioReady=false, clock={time:0,at:0}, buffer='';
  const abort=()=>{recorder?.kill('SIGKILL');browser?.close().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(()=>job.controller.abort(),(scene.end-scene.start+100)*1000);
  try {
    check(signal);
    browser=await chromium.launch({headless:false,ignoreDefaultArgs:['--mute-audio'],args:['--kiosk','--window-position=0,0','--window-size=720,1280'],env:{...process.env,DISPLAY:':99',PULSE_SINK:'capture'}});
    const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
    // The renderer has a fixed address; never navigate to a user supplied URL.
    await page.goto(rootURL+'/render',{waitUntil:'load'});
    await page.waitForFunction(()=>!!window.captureRenderer);
    await page.evaluate(s=>window.captureRenderer.prepare(s),scene);
    const deadline=Date.now()+20000;
    while(true){check(signal);const s=await page.evaluate(()=>window.captureRenderer.warmStatus());if(s.error)throw new Error(s.error);if(s.ready)break;if(Date.now()>deadline)throw new Error('Player preparation timeout');await delay(100);}
    await page.evaluate(()=>window.captureRenderer.pause()); await delay(250); await page.evaluate(()=>window.captureRenderer.cue());await delay(500);
    const raw=path.join(dir,'raw.mkv');
    recorder=spawn('ffmpeg',['-y','-v','error','-thread_queue_size','512','-f','x11grab','-draw_mouse','0','-framerate','30','-video_size','720x1280','-i',':99.0+0,0','-thread_queue_size','512','-f','pulse','-i','capture.monitor','-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-c:a','pcm_s16le','-af','aresample=async=1:first_pts=0','-progress','pipe:1','-stats_period','0.1',raw],{stdio:['pipe','pipe','pipe']});
    recorder.stderr.on('data',x=>{recordingError=(recordingError+x).slice(-2000);});
    recorderDone=new Promise(resolve=>{recorder.on('error',e=>{recordingError=e.message;resolve(-1);});recorder.on('close',resolve);});
    recorder.stdout.on('data',x=>{buffer+=x;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){const m=/^out_time_us=(\d+)/.exec(line);if(m){clock={time:Number(m[1])/1e6,at:performance.now()};audioReady=clock.time>.1;}}});
    const readyBy=Date.now()+15000;
    while(!audioReady){check(signal);if(recorder.exitCode!==null||Date.now()>readyBy)throw new Error('Recorder unavailable '+recordingError);await delay(100);}
    const pageTime=await page.evaluate(()=>performance.now());
    const recordTime=clock.time+(performance.now()-clock.at)/1000;
    await page.evaluate(()=>window.captureRenderer.begin());
    job.state='recording';let status;
    while(true){
      check(signal);if(recorder.exitCode!==null)throw new Error('Recorder stopped '+recordingError);
      status=await page.evaluate(()=>window.captureRenderer.status());
      if(status.error)throw new Error(status.error);
      job.percent=Math.min(99,status.percent);
      if(status.finished)break;
      if(!status.startAt&&Date.now()>readyBy+15000)throw new Error('Playback did not start');
      await delay(100);
    }
    job.state='finalizing';await delay(250);recorder.stdin.write('q\n');
    const code=await Promise.race([recorderDone,delay(5000).then(()=>-1)]);if(code!==0)throw new Error('Recorder finalization failed '+recordingError);
    const offset=Math.max(0,recordTime+(status.startAt-pageTime)/1000);
    const duration=scene.end-scene.start;
    const file=path.join(dir,'clip.mp4');
    await runProcess('ffmpeg',['-y','-v','error','-ss',String(offset),'-i',raw,'-t',String(duration),'-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-movflags','+faststart',file],signal);
    await verifyFile(file,duration,signal);await rm(raw,{force:true});
  } finally {clearTimeout(timeout);signal.removeEventListener('abort',abort);if(recorder&&recorder.exitCode===null)recorder.kill('SIGKILL');await browser?.close().catch(()=>{});}
}
