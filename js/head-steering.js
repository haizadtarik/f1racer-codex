import { headTarget } from './game-utils.js';

const FACE_LOSS_GRACE_MS = 600;

export class HeadSteeringController {
  constructor({ video, onTarget, onStatus }) {
    this.video = video;
    this.onTarget = onTarget;
    this.onStatus = onStatus;
    this.stream = null;
    this.faceLandmarker = null;
    this.neutralNoseX = null;
    this.latestNoseX = null;
    this.faceMissingAt = null;
    this.faceMissingNotified = false;
    this.frameId = null;
    this.lastVideoTime = -1;
    this.isRunning = false;
    this.startupGeneration = 0;
    this.stoppedStreams = new WeakSet();
    this.processFrame = this.processFrame.bind(this);
  }

  publish(kind, message) {
    this.onStatus({ kind, message });
  }

  async loadLandmarker(assignToController = true) {
    const { FaceLandmarker, FilesetResolver } = await import('../vendor/mediapipe/tasks-vision/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks('./vendor/mediapipe/tasks-vision/wasm');
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: './vendor/mediapipe/models/face_landmarker.task' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: .5,
      minFacePresenceConfidence: .5,
      minTrackingConfidence: .5,
    });
    if (assignToController) this.faceLandmarker = faceLandmarker;
    return faceLandmarker;
  }

  async start() {
    if (this.isRunning) return;
    const startupGeneration = ++this.startupGeneration;
    let stream = null;
    let faceLandmarker = null;

    try {
      const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
      if (!window.isSecureContext && !isLocalhost) {
        throw new Error('Head steering requires a secure context or localhost.');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (startupGeneration !== this.startupGeneration) {
        this.cleanupStaleStartup(stream, faceLandmarker);
        return;
      }
      this.stream = stream;
      this.video.srcObject = this.stream;
      await this.video.play();
      if (startupGeneration !== this.startupGeneration) {
        this.cleanupStaleStartup(stream, faceLandmarker);
        return;
      }
      faceLandmarker = await this.loadLandmarker(false);
      if (startupGeneration !== this.startupGeneration) {
        this.cleanupStaleStartup(stream, faceLandmarker);
        return;
      }
      this.faceLandmarker = faceLandmarker;
      this.isRunning = true;
      this.publish('ready', 'Camera ready. Centre your head to auto-calibrate.');
      this.processFrame();
    } catch (error) {
      if (startupGeneration !== this.startupGeneration) {
        this.cleanupStaleStartup(stream, faceLandmarker);
        return;
      }
      this.stop();
      this.publish('error', this.startErrorMessage(error));
      throw error;
    }
  }

  cleanupStaleStartup(stream, faceLandmarker) {
    this.stopStream(stream);
    faceLandmarker?.close();

    if (this.stream === stream) {
      this.stream = null;
      if (this.video.srcObject === stream) this.video.srcObject = null;
    }
    if (this.faceLandmarker === faceLandmarker) this.faceLandmarker = null;
  }

  stopStream(stream) {
    if (!stream || this.stoppedStreams.has(stream)) return;
    this.stoppedStreams.add(stream);
    stream.getTracks().forEach((track) => track.stop());
  }

  startErrorMessage(error) {
    if (error?.name === 'NotAllowedError') return 'Camera permission was denied.';
    if (error?.name === 'NotFoundError') return 'No camera was found.';
    return 'Head steering could not start. Try another control.';
  }

  processFrame() {
    if (!this.isRunning) return;

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      let result;
      try {
        result = this.faceLandmarker.detectForVideo(this.video, performance.now());
      } catch {
        this.stop();
        this.publish('error', 'Head steering could not start. Try another control.');
        return;
      }
      const landmarks = result.faceLandmarks?.[0];

      if (landmarks?.[1]) {
        this.latestNoseX = 1 - landmarks[1].x;
        this.faceMissingAt = null;
        this.faceMissingNotified = false;
        if (this.neutralNoseX === null) {
          this.neutralNoseX = this.latestNoseX;
          this.publish('ready', 'Centre position calibrated.');
        }
        if (typeof this.neutralNoseX === 'number') {
          this.onTarget(headTarget(this.latestNoseX, this.neutralNoseX));
        }
      } else {
        this.handleMissingFace();
      }
    }

    if (this.isRunning) {
      this.frameId = requestAnimationFrame(this.processFrame);
    }
  }

  handleMissingFace() {
    const now = performance.now();
    if (this.faceMissingAt === null) this.faceMissingAt = now;
    if (!this.faceMissingNotified && now - this.faceMissingAt >= FACE_LOSS_GRACE_MS) {
      this.faceMissingNotified = true;
      this.publish('warning', 'Face not detected. Hold still or use another control.');
    }
  }

  calibrate() {
    if (typeof this.latestNoseX !== 'number') {
      this.publish('warning', 'Face not detected. Look at the camera, then try again.');
      return;
    }

    this.neutralNoseX = this.latestNoseX;
    this.publish('ready', 'Centre position calibrated.');
  }

  stop() {
    this.startupGeneration += 1;
    this.isRunning = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;

    this.stopStream(this.stream);
    this.stream = null;
    this.video.srcObject = null;

    this.faceLandmarker?.close();
    this.faceLandmarker = null;
    this.neutralNoseX = null;
    this.latestNoseX = null;
    this.faceMissingAt = null;
    this.faceMissingNotified = false;
    this.lastVideoTime = -1;
    this.publish('off', 'Head steering off.');
  }
}
