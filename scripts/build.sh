#!/usr/bin/env bash
# Full build: fonts → music → frames → final MP4 with sound.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules/@napi-rs/canvas ] || npm install
ls assets/fonts/*.ttf >/dev/null 2>&1 || bash scripts/fetch-fonts.sh

node src/audio/synth.js --out out/music.wav
node src/render.js --video --out out/video.mp4

ffmpeg -y -loglevel error -stats \
  -i out/video.mp4 -i out/music.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 \
  -shortest -movflags +faststart \
  out/hoplite-reel.mp4

echo "→ out/hoplite-reel.mp4"
