const manifestUrl = 'dash/manifest.mpd';

let manifestBaseUrl;
let initTmpl;
let segmentTmpl;
let mimeType;
let videoDuration;
let segmentDuration;
let segmentMax;
let representations;

let representation;
let segmentNumber = 1;
const sourceBufferQueue = [];

const video = document.querySelector('.video');
const controls = document.querySelector('.controls');

let mediaSource;
let sourceBuffer;

(async () => {
  mediaSource = new MediaSource();

  await initializeManifestFile();
  await initializeVideoElement();
  await initializeUserInterface();
  await initializeSourceBuffer();
  await processSourceBufferQueue();
  await loadNextSegment(5);
  await loadSegmentsOnTimeUpdate();
  await loadSegmentsOnSeek();
})();

async function initializeManifestFile() {
  const manifestResponse = await fetch(manifestUrl);
  const manifestText = await manifestResponse.text();

  const parser = new DOMParser();
  const manifest = parser.parseFromString(manifestText, 'text/xml');

  manifestBaseUrl = manifestResponse.url.split('/').slice(0, -1).join('/') + '/';
  initTmpl = manifest.querySelectorAll('SegmentTemplate')[0].getAttribute('initialization');
  segmentTmpl = manifest.querySelectorAll('SegmentTemplate')[0].getAttribute('media');
  mimeType = 'video/mp4; codecs="avc1.424034"';
  videoDuration = convertPresentationTimeToSeconds(
    manifest.querySelector('MPD').getAttribute('mediaPresentationDuration')
  );
  segmentDuration = convertPresentationTimeToSeconds(manifest.querySelector('MPD').getAttribute('maxSegmentDuration'));
  segmentMax = Math.ceil(videoDuration / segmentDuration);
  representations = [...manifest.querySelectorAll('AdaptationSet:first-child Representation')].map((representation) =>
    representation.getAttribute('id')
  );
  representation = representations[0];
}

async function initializeVideoElement() {
  video.src = URL.createObjectURL(mediaSource);
  await new Promise((resolve) => {
    mediaSource.addEventListener('sourceopen', resolve, { once: true });
  });
  video.classList.remove('hidden');
}

async function initializeUserInterface() {
  const activeClass = 'active';

  for (const rep of representations) {
    const button = document.createElement('button');
    button.dataset.quality = rep;
    button.textContent = rep;
    if (rep === representation) {
      button.classList.add(activeClass);
    }
    controls.append(button);
  }

  controls.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (target) {
      const current = controls.querySelector('.active');
      if (current) {
        current.classList.remove(activeClass);
      }
      target.classList.add(activeClass);
      representation = target.dataset.quality;
      initializeSourceBuffer();
    }
  });
}

async function initializeSourceBuffer() {
  const initUrl = manifestBaseUrl + initTmpl.replace('$RepresentationID$', representation);
  const initResponse = await fetch(initUrl);
  const initBuffer = await initResponse.arrayBuffer();

  if (!sourceBuffer) {
    sourceBuffer = mediaSource.addSourceBuffer(mimeType);
  }
  sourceBufferQueue.push(initBuffer);
}

async function loadNextSegment(segmentsToLoad = 1) {
  while (segmentsToLoad-- > 0) {
    const segmentUrl =
      manifestBaseUrl + segmentTmpl.replace('$RepresentationID$', representation).replace('$Number$', segmentNumber++);
    const segmentResponse = await fetch(segmentUrl);
    const segmentBuffer = await segmentResponse.arrayBuffer();
    sourceBufferQueue.push(segmentBuffer);
  }
}

async function loadSegmentsOnTimeUpdate() {
  const timeRangeAllowance = 4; // seconds
  video.addEventListener('timeupdate', async () => {
    const timeRange = getCurrentTimeRange();
    if (timeRange && video.currentTime > timeRange.end - timeRangeAllowance && segmentNumber <= segmentMax) {
      await loadNextSegment();
    }
  });
}

async function loadSegmentsOnSeek() {
  video.addEventListener('seeking', async () => {
    const timeRange = getCurrentTimeRange();
    if (!timeRange) {
      segmentNumber = Math.floor(video.currentTime / segmentDuration) - 2;
      await loadNextSegment(5);
    }
  });
}

async function processSourceBufferQueue() {
  if (!sourceBuffer.updating && sourceBufferQueue.length > 0) {
    const buffer = sourceBufferQueue.shift();
    sourceBuffer.appendBuffer(buffer);
    await flushSourceBufferUpdate();
  }
  requestAnimationFrame(processSourceBufferQueue);
}

function flushSourceBufferUpdate() {
  return new Promise((resolve) => {
    sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
  });
}

function getCurrentTimeRange() {
  for (let i = 0; i < video.buffered.length; i++) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (video.currentTime >= start && video.currentTime <= end) {
      return { start, end };
    }
  }
  return null;
}

function convertPresentationTimeToSeconds(time) {
  const match = time.match(/^PT(\d+)H(\d+)M(\d+(?:\.\d+)?)S$/);
  if (match) {
    let [, hours, minutes, seconds] = match;
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    seconds = parseFloat(seconds);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}
