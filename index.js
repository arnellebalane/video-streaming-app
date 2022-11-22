const manifestUrl = 'dash/manifest.mpd';
const template = 'dash/segment-$RepresentationID$-$Number$.m4s';
const initialization = 'dash/segment-$RepresentationID$-.mp4';
const mimeType = 'video/mp4; codecs="avc1.424034"';

const videoDuration = 14 * 60 + 48.053;
const segmentDuration = 4.011;
const representations = ['480p', '720p', '1080p'];
let representation = representations[0];
const segmentMaxNumber = 222;
let segmentNumber = 1;
const sourceBufferQueue = [];

const video = document.querySelector('.video');
const controls = document.querySelector('.controls');

let mediaSource;
let sourceBuffer;

(async () => {
  mediaSource = new MediaSource();

  await createVideoElement();
  await initializeUserInterface();
  await initializeSourceBuffer();
  await processSourceBufferQueue();
  await loadNextSegment(5);
  await loadSegmentsOnTimeUpdate();
  await loadSegmentsOnSeek();
})();

async function createVideoElement() {
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
  const initializationUrl = initialization.replace('$RepresentationID$', representation);
  const initializationResponse = await fetch(initializationUrl);
  const initializationBuffer = await initializationResponse.arrayBuffer();

  if (!sourceBuffer) {
    sourceBuffer = mediaSource.addSourceBuffer(mimeType);
  }
  sourceBufferQueue.push(initializationBuffer);
}

async function loadNextSegment(segmentsToLoad = 1) {
  while (segmentsToLoad-- > 0) {
    const segmentUrl = template.replace('$RepresentationID$', representation).replace('$Number$', segmentNumber++);
    const segmentResponse = await fetch(segmentUrl);
    const segmentBuffer = await segmentResponse.arrayBuffer();
    sourceBufferQueue.push(segmentBuffer);
  }
}

async function loadSegmentsOnTimeUpdate() {
  const timeRangeAllowance = 4; // seconds
  video.addEventListener('timeupdate', async () => {
    const timeRange = getCurrentTimeRange();
    if (timeRange && video.currentTime > timeRange.end - timeRangeAllowance && segmentNumber <= segmentMaxNumber) {
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
