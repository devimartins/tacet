# Claude: builds a scene whose captions show the source time ("12s"), to check start/end alignment.
import json, sys
vid, start, dur, style, crop, caps, name = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]=='1', sys.argv[6]=='1', sys.argv[7]
words = [{"w": f"{int(start+i)}s", "p": "solo", "s": start+i, "e": start+i+0.9} for i in range(int(dur))]
scene = {"videoId": vid, "start": start, "end": start+dur, "style": style, "captions": caps, "crop": crop, "mode": "center",
         "x": 0.5, "y": 0.72, "sync": 0, "words": words, "segments": [{"p": "solo", "s": start, "e": start+dur}],
         "names": {}, "positions": {"solo": 50}, "pair": []}
open(f"/opt/test/{name}.json", "w").write(json.dumps(scene))
