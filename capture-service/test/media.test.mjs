import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runProcess, verifyFile } from '../worker.mjs';
test('verifies a real 9:16 MP4 with audio and rejects wrong duration or missing audio',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forjaclip-test-'));
  try {
    const file=path.join(dir,'valid.mp4');
    await runProcess('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=720x1280:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',file]);
    await verifyFile(file,1);await assert.rejects(()=>verifyFile(file,3));
    const silent=path.join(dir,'no-audio.mp4');await runProcess('ffmpeg',['-y','-v','error','-i',file,'-an','-c:v','copy',silent]);
    await assert.rejects(()=>verifyFile(silent,1));
  } finally {await rm(dir,{recursive:true,force:true});}
});
