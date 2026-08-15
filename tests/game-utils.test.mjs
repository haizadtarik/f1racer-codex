import test from 'node:test';
import assert from 'node:assert/strict';
import * as gameUtils from '../js/game-utils.js';

const { clampLane, hasCollision, modeForScreen, raceInputDirection } = gameUtils;

test('clamps steering to the three playable lanes', () => {
  assert.equal(clampLane(-1), 0);
  assert.equal(clampLane(1), 1);
  assert.equal(clampLane(4), 2);
});

test('maps lane controls to three horizontal targets', () => {
  assert.equal(gameUtils.laneTarget(0), 0);
  assert.equal(gameUtils.laneTarget(1), .5);
  assert.equal(gameUtils.laneTarget(2), 1);
});

test('maps mirrored nose movement around calibration to a clamped target', () => {
  assert.equal(gameUtils.headTarget(.5, .5), .5);
  assert.equal(gameUtils.headTarget(.52, .5), .5);
  assert.ok(Math.abs(gameUtils.headTarget(.35, .5) - .125) < 1e-12);
  assert.equal(gameUtils.headTarget(.1, .5), 0);
  assert.equal(gameUtils.headTarget(.9, .5), 1);
});

test('eases the car toward a smooth steering target', () => {
  assert.ok(Math.abs(gameUtils.easeToward(.2, .8, .25) - .35) < 1e-12);
  assert.equal(gameUtils.easeToward(.5, 1, 1), 1);
});

test('detects only overlapping rectangles', () => {
  const player = { x: 100, y: 300, width: 60, height: 90 };
  assert.equal(hasCollision(player, { x: 130, y: 340, width: 50, height: 60 }), true);
  assert.equal(hasCollision(player, { x: 161, y: 340, width: 50, height: 60 }), false);
  assert.equal(hasCollision(player, { x: 130, y: 391, width: 50, height: 60 }), false);
});

test('keeps horizontally overlapping cones separated by a safe gap', () => {
  assert.equal(typeof gameUtils.hasSafeObstacleGap, 'function');
  const cone = { x: 100, y: 0, width: 24, height: 50 };
  const nearbyCone = { x: 100, y: 120, width: 24, height: 50 };
  const distantCone = { x: 100, y: 180, width: 24, height: 50 };

  assert.equal(gameUtils.hasSafeObstacleGap([nearbyCone], cone, 80), false);
  assert.equal(gameUtils.hasSafeObstacleGap([distantCone], cone, 80), true);
  assert.equal(gameUtils.hasSafeObstacleGap([{ ...nearbyCone, x: 200 }], cone, 80), true);
});

test('rotates the player sprite toward the top of the track', () => {
  assert.deepEqual(gameUtils.playerSpriteTransform({ x: 10, y: 20, width: 30, height: 40 }), {
    centerX: 25,
    centerY: 40,
    rotation: Math.PI,
  });
});

test('positions the player far enough ahead to keep the rear tyres visible', () => {
  assert.equal(typeof gameUtils.playerStartY, 'function');
  assert.equal(gameUtils.playerStartY(640), 410);
  assert.equal(gameUtils.playerStartY(1000), 640);
});

test('marks the visible race screen as an active racing state', () => {
  assert.equal(modeForScreen('race'), 'racing');
  assert.equal(modeForScreen('start'), 'start');
});

test('accepts steering keys only while a race is live', () => {
  assert.equal(raceInputDirection('racing', 'a'), -1);
  assert.equal(raceInputDirection('racing', 'ArrowRight'), 1);
  assert.equal(raceInputDirection('gameover', 'a'), 0);
  assert.equal(raceInputDirection('racing', 'x'), 0);
});

test('pauses a race for head-steering calibration before restarting it', () => {
  assert.equal(gameUtils.headSteeringRaceMode('racing', 'enable'), 'calibrating');
  assert.equal(gameUtils.headSteeringRaceMode('calibrating', 'calibrated'), 'racing');
  assert.equal(gameUtils.headSteeringRaceMode('start', 'enable'), 'start');
});

test('keeps head steering active while waiting for the first face', () => {
  assert.equal(gameUtils.isHeadSteeringActiveMode('calibrating'), true);
  assert.equal(gameUtils.isHeadSteeringActiveMode('racing'), true);
  assert.equal(gameUtils.isHeadSteeringActiveMode('start'), false);
});
