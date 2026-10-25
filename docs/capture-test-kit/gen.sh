# Claude: 75 s synthetic clip: timestamp pattern, white flash + 1 kHz beep for 0.1 s at every whole second.
ffmpeg -v error -y -f lavfi -i testsrc=size=1280x720:rate=30:duration=75 -f lavfi -i sine=f=1000:d=75:sample_rate=48000 \
 -filter_complex "[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='lt(mod(t,1),0.1)'[v];[1:a]volume='if(lt(mod(t,1),0.1),0.8,0)':eval=frame,aformat=channel_layouts=stereo[a]" \
 -map '[v]' -map '[a]' -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 1M -c:a libopus /opt/test/test.webm && ls -la /opt/test/test.webm
