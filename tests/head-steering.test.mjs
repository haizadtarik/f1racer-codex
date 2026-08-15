import assert from 'node:assert/strict';
import test from 'node:test';

const browserGlobals = ['window', 'navigator', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'];

function installBrowserGlobals({ getUserMedia, now = () => 0 }) {
  const originalDescriptors = new Map(
    browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const frameCallbacks = new Map();
  let nextFrameId = 1;

  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      value: { isSecureContext: true, location: { hostname: 'localhost' } },
    },
    navigator: {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    },
    performance: { configurable: true, value: { now } },
    requestAnimationFrame: {
      configurable: true,
      value: (callback) => {
        const frameId = nextFrameId++;
        frameCallbacks.set(frameId, callback);
        return frameId;
      },
    },
    cancelAnimationFrame: {
      configurable: true,
      value: (frameId) => frameCallbacks.delete(frameId),
    },
  });

  return {
    frameCallbacks,
    restore() {
      for (const name of browserGlobals) {
        const descriptor = originalDescriptors.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

async function loadController() {
  const moduleUrl = new URL('../js/head-steering.js', import.meta.url);
  const module = await import(`${moduleUrl.href}?head-steering-test=${Date.now()}-${Math.random()}`);
  return module.HeadSteeringController;
}

function createVideo() {
  return {
    currentTime: 1,
    srcObject: null,
    play: async () => {},
  };
}

test('stale startup stops a stream acquired after stop without becoming ready', async () => {
  let resolveStream;
  const track = { stopCalls: 0, stop() { this.stopCalls += 1; } };
  const stream = { getTracks: () => [track] };
  const browser = installBrowserGlobals({
    getUserMedia: () => new Promise((resolve) => { resolveStream = resolve; }),
  });

  try {
    const HeadSteeringController = await loadController();
    const statuses = [];
    const video = createVideo();
    const controller = new HeadSteeringController({
      video,
      onTarget: () => {},
      onStatus: (status) => statuses.push(status),
    });
    controller.loadLandmarker = async () => {
      return {
        close: () => {},
        detectForVideo: () => ({ faceLandmarks: [] }),
      };
    };

    const starting = controller.start();
    controller.stop();
    resolveStream(stream);
    await starting;

    assert.equal(track.stopCalls, 1);
    assert.equal(controller.stream, null);
    assert.equal(controller.faceLandmarker, null);
    assert.equal(video.srcObject, null);
    assert.equal(controller.isRunning, false);
    assert.equal(browser.frameCallbacks.size, 0);
    assert.equal(statuses.some(({ kind }) => kind === 'ready'), false);
    assert.deepEqual(statuses.at(-1), { kind: 'off', message: 'Head steering off.' });
  } finally {
    browser.restore();
  }
});

test('a stale startup after video playback does not disrupt a newer startup', async () => {
  const firstTrack = { stopCalls: 0, stop() { this.stopCalls += 1; } };
  const secondTrack = { stopCalls: 0, stop() { this.stopCalls += 1; } };
  const firstStream = { getTracks: () => [firstTrack] };
  const secondStream = { getTracks: () => [secondTrack] };
  let getUserMediaCalls = 0;
  const browser = installBrowserGlobals({
    getUserMedia: async () => (++getUserMediaCalls === 1 ? firstStream : secondStream),
  });

  try {
    const HeadSteeringController = await loadController();
    const video = createVideo();
    let resolveFirstPlay;
    let playCalls = 0;
    video.play = () => {
      playCalls += 1;
      return playCalls === 1
        ? new Promise((resolve) => { resolveFirstPlay = resolve; })
        : Promise.resolve();
    };
    const controller = new HeadSteeringController({
      video,
      onTarget: () => {},
      onStatus: () => {},
    });
    const secondDetector = {
      closeCalls: 0,
      close() { this.closeCalls += 1; },
      detectForVideo: () => ({ faceLandmarks: [] }),
    };
    controller.loadLandmarker = async () => {
      return secondDetector;
    };

    const firstStarting = controller.start();
    while (playCalls === 0) await Promise.resolve();
    controller.stop();
    await controller.start();
    resolveFirstPlay();
    await firstStarting;

    assert.equal(firstTrack.stopCalls, 1);
    assert.equal(secondTrack.stopCalls, 0);
    assert.equal(secondDetector.closeCalls, 0);
    assert.equal(controller.stream, secondStream);
    assert.equal(controller.faceLandmarker, secondDetector);
    assert.equal(video.srcObject, secondStream);
    assert.equal(controller.isRunning, true);
  } finally {
    browser.restore();
  }
});

test('inference failure after startup stops the camera and reports an actionable error', async () => {
  const track = { stopCalls: 0, stop() { this.stopCalls += 1; } };
  const stream = { getTracks: () => [track] };
  const browser = installBrowserGlobals({ getUserMedia: async () => stream });

  try {
    const HeadSteeringController = await loadController();
    const statuses = [];
    const video = createVideo();
    const controller = new HeadSteeringController({
      video,
      onTarget: () => {},
      onStatus: (status) => statuses.push(status),
    });
    let detectCalls = 0;
    const detector = {
      closeCalls: 0,
      close() { this.closeCalls += 1; },
      detectForVideo() {
        detectCalls += 1;
        if (detectCalls === 2) throw new Error('inference failed');
        return { faceLandmarks: [] };
      },
    };
    controller.loadLandmarker = async () => detector;

    await controller.start();
    video.currentTime = 2;
    const [frameCallback] = browser.frameCallbacks.values();
    assert.doesNotThrow(() => frameCallback());

    assert.equal(track.stopCalls, 1);
    assert.equal(detector.closeCalls, 1);
    assert.equal(controller.stream, null);
    assert.equal(controller.faceLandmarker, null);
    assert.equal(video.srcObject, null);
    assert.equal(controller.isRunning, false);
    assert.deepEqual(statuses.at(-1), {
      kind: 'error',
      message: 'Head steering could not start. Try another control.',
    });
  } finally {
    browser.restore();
  }
});

test('first detected face automatically calibrates head steering', async () => {
  const track = { stop() {} };
  const stream = { getTracks: () => [track] };
  const browser = installBrowserGlobals({ getUserMedia: async () => stream });

  try {
    const HeadSteeringController = await loadController();
    const statuses = [];
    const controller = new HeadSteeringController({
      video: createVideo(),
      onTarget: () => {},
      onStatus: (status) => statuses.push(status),
    });
    controller.loadLandmarker = async () => ({
      close() {},
      detectForVideo: () => ({ faceLandmarks: [[{}, { x: .5 }]] }),
    });

    await controller.start();

    assert.equal(controller.neutralNoseX, .5);
    assert.ok(statuses.some(({ message }) => message === 'Centre position calibrated.'));
  } finally {
    browser.restore();
  }
});
