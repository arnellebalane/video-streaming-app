# Video Streaming App

## Dependencies

- [ffmpeg](https://ffmpeg.org/)
- [mp4box](https://github.com/gpac/gpac/wiki/mp4box-filters)

## Generate DASH artifacts

```bash
# NOTE: if you encounter issues when running these commands, try running them
# without the comments and in a single line (i.e. remove the backslashes)

# inspect source properties
ffprobe artifacts/source-1080p.mkv -hide_banner

# generate intermediary video artifacts
# 480p
ffmpeg -i artifacts/source-1080p.mkv \
  -c:v libx264 \              # video encoder
  -r 24 \                     # frame rate
  -x264opts 'keyint=48:min-keyint=48:no-scenecut' \
  -vf scale=-2:480 \          # resize video to 480p
  -b:v 1050k \                # video bitrate
  -maxrate 1050k \            # video max bitrate
  -bufsize 2100k \            # buffer size, good starting point to be double the bitrate
  -movflags faststart \
  -profile:v main \
  -preset ultrafast \
  -an \                       # exclude audio track
  "artifacts/intermediate-480p-1050k.mp4"

# 720p
ffmpeg -i artifacts/source-1080p.mkv \
  -c:v libx264 \              # video encoder
  -r 24 \                     # frame rate
  -x264opts 'keyint=48:min-keyint=48:no-scenecut' \
  -vf scale=-2:720 \          # resize video to 720p
  -b:v 3000k \                # video bitrate
  -maxrate 3000k \            # video max bitrate
  -bufsize 6000k \            # buffer size, good starting point to be double the bitrate
  -movflags faststart \
  -profile:v main \
  -preset ultrafast \
  -an \                       # exclude audio track
  "artifacts/intermediate-720p-3000k.mp4"

# 1080p
ffmpeg -i artifacts/source-1080p.mkv \
  -c:v libx264 \              # video encoder
  -r 24 \                     # frame rate
  -x264opts 'keyint=48:min-keyint=48:no-scenecut' \
  -vf scale=-2:1080 \         # resize video to 1080p
  -b:v 5800k \                # video bitrate
  -maxrate 5800k \            # video max bitrate
  -bufsize 11600k \           # buffer size, good starting point to be double the bitrate
  -movflags faststart \
  -profile:v main \
  -preset ultrafast \
  -an \                       # exclude audio track
  "artifacts/intermediate-1080p-5800k.mp4"

# generate intermediary audio artifacts
ffmpeg -i artifacts/source-1080p.mkv \
  -map 0:1 \                  # gets the audio track by index (index 0 is the video)
  -c:a aac \                  # audio encoder
  -b:a 640k \                 # audio bitrate
  -ar 48000 \                 # sampling rate (48 kHz)
  -ac 2 \                     # audio channels (2 = stereo)
  -vn \                       # exclude video track
  artifacts/audio.m4a

# package into dash manifest
MP4Box \
  -dash 4000 \                # break videos into 4-second segments
  -frag 4000 \                # break videos into 4-second segments
  -rap \
  -segment-name 'segment-$RepresentationID$-' \   # pattern for segment names
  -fps 24 \                   # frame rate
  artifacts/intermediate-480p-1050k.mp4#video:id=480p \
  artifacts/intermediate-720p-3000k.mp4#video:id=720p \
  artifacts/intermediate-1080p-5800k.mp4#video:id=1080p \
  artifacts/audio.m4a#audio:id=English:role=main \
  -out dash/manifest.mpd
```

## Usual bitrates and resolutions

<!-- prettier-ignore-start -->
| Bitrate (kbps) | Resolution |
| 235            | 320x240    |
| 375            | 384x288    |
| 560            | 512x384    |
| 750            | 512x384    |
| 1050           | 640x480    |
| 1750           | 720x480    |
| 2350           | 1280x720   |
| 3000           | 1280x720   |
| 4300           | 1920x1080  |
| 5800           | 1920x1080  |
<!-- prettier-ignore-end -->
