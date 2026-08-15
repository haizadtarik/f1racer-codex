export function clampLane(lane) {
  return Math.max(0, Math.min(2, lane));
}

export function laneTarget(lane) {
  return clampLane(lane) / 2;
}

export function headTarget(noseX, neutralNoseX) {
  const mirroredDelta = noseX - neutralNoseX;
  if (Math.abs(mirroredDelta) < .025) return .5;
  return Math.max(0, Math.min(1, .5 + mirroredDelta / .4));
}

export function easeToward(current, target, amount) {
  return current + (target - current) * Math.max(0, Math.min(1, amount));
}

export function hasCollision(player, obstacle) {
  return player.x < obstacle.x + obstacle.width
    && player.x + player.width > obstacle.x
    && player.y < obstacle.y + obstacle.height
    && player.y + player.height > obstacle.y;
}

export function hasSafeObstacleGap(obstacles, candidate, minimumGap) {
  return obstacles
    .filter((obstacle) => candidate.x < obstacle.x + obstacle.width
      && candidate.x + candidate.width > obstacle.x)
    .every((obstacle) => candidate.y + candidate.height + minimumGap <= obstacle.y
      || candidate.y >= obstacle.y + obstacle.height + minimumGap);
}

export function playerSpriteTransform(box) {
  return {
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
    rotation: Math.PI,
  };
}

export function playerStartY(trackHeight) {
  return Math.round(trackHeight * .64);
}

export function modeForScreen(screen) {
  return screen === 'race' ? 'racing' : screen;
}

export function raceInputDirection(mode, key) {
  if (mode !== 'racing') return 0;
  const normalized = key.toLowerCase();
  if (normalized === 'arrowleft' || normalized === 'a') return -1;
  if (normalized === 'arrowright' || normalized === 'd') return 1;
  return 0;
}

export function headSteeringRaceMode(mode, event) {
  if (mode === 'racing' && event === 'enable') return 'calibrating';
  if (mode === 'calibrating' && event === 'calibrated') return 'racing';
  return mode;
}

export function isHeadSteeringActiveMode(mode) {
  return mode === 'calibrating' || mode === 'racing';
}
