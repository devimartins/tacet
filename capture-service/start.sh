#!/bin/sh
set -eu
Xvfb :99 -screen 0 720x1280x24 -nolisten tcp &
pulseaudio --start --exit-idle-time=-1
pactl load-module module-null-sink sink_name=capture rate=48000 channels=2 >/dev/null
pactl set-default-sink capture
exec node server.mjs
