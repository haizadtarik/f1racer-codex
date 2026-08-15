import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const vendorDirectory = new URL('../vendor/mediapipe/tasks-vision/', import.meta.url);
const runtimeUrl = new URL('vision_bundle.mjs', vendorDirectory);
const sourceMapUrl = new URL('vision_bundle.mjs.map', vendorDirectory);
const remoteUrlPattern = /https?:\/\//;

test('vendored MediaPipe artifacts contain no remote URL literals', async () => {
  const [runtime, sourceMap] = await Promise.all([
    readFile(runtimeUrl, 'utf8'),
    readFile(sourceMapUrl, 'utf8'),
  ]);

  for (const [artifact, contents] of [
    ['vision_bundle.mjs', runtime],
    ['vision_bundle.mjs.map', sourceMap],
  ]) {
    assert.doesNotMatch(contents, /odml\.pa\.googleapis\.com/, `${artifact} contains the MediaPipe telemetry endpoint`);
    assert.doesNotMatch(contents, remoteUrlPattern, `${artifact} contains a remote URL literal`);
  }

  assert.match(runtime, /export\{[^}]*\bFaceLandmarker\b/, 'vision bundle preserves FaceLandmarker export');
  assert.match(runtime, /export\{[^}]*\bFilesetResolver\b/, 'vision bundle preserves FilesetResolver export');
});
