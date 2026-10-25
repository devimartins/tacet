# Claude: checks one capture: streams, loudness, beep onsets vs flash onsets, and a 3-frame strip.
f=/out/$1/clip.mp4
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate:format=duration -of compact "$f"
ffmpeg -i "$f" -af volumedetect -f null - 2>&1 | grep -o 'max_volume: .*'
echo beeps: $(ffmpeg -i "$f" -af silencedetect=n=-35dB:d=0.3 -f null - 2>&1 | grep -o 'silence_end: [0-9.]*' | cut -d' ' -f2 | head -6)
echo flashes: $(ffmpeg -i "$f" -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=- -f null - 2>/dev/null | awk '/pts_time/{split($0,a,"pts_time:");t=a[2]} /YAVG/{split($0,b,"=");if(b[2]>170&&!on){printf "%s ",t;on=1} if(b[2]<=170)on=0}' | cut -d' ' -f1-6)
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
ffmpeg -v error -y -ss 0.5 -i "$f" -ss $(awk "BEGIN{print $d/2}") -i "$f" -sseof -0.6 -i "$f" -filter_complex "[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1[b];[2:v]trim=end_frame=1[c];[a][b][c]hstack=3,scale=1080:-1" -frames:v 1 /out/$1-strip.png && echo strip ok
