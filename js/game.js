import { easeToward, hasSafeObstacleGap, hasCollision, headSteeringRaceMode, isHeadSteeringActiveMode, laneTarget, modeForScreen, playerSpriteTransform, playerStartY, raceInputDirection } from './game-utils.js';
import { HeadSteeringController } from './head-steering.js?v=5';
import { getBestScore, loadScores, saveScore } from './storage.js';

const canvas = document.querySelector('#race-canvas');
const context = canvas.getContext('2d');
const screens = [...document.querySelectorAll('.screen')];
const refs = {
  bestScore: document.querySelector('#best-score'),
  score: document.querySelector('#score-value'),
  finalScore: document.querySelector('#final-score'),
  form: document.querySelector('#score-form'),
  name: document.querySelector('#player-name'),
  save: document.querySelector('#save-score-button'),
  status: document.querySelector('#status-message'),
  leaderboard: document.querySelector('#leaderboard-list'),
  left: document.querySelector('#move-left'),
  right: document.querySelector('#move-right'),
  headSteeringPreview: document.querySelector('#head-steering-preview'),
  headSteeringStatus: document.querySelector('#head-steering-status'),
  enableHeadSteering: document.querySelector('#enable-head-steering'),
  calibrateHeadSteering: document.querySelector('#calibrate-head-steering'),
  stopHeadSteering: document.querySelector('#stop-head-steering'),
};

const state = {
  mode: 'start', playerTarget: .5, playerPosition: .5, obstacles: [], score: 0, startedAt: 0,
  lastFrame: 0, spawnAt: 0, frameId: null, width: 0, height: 0,
};
const headSteering = new HeadSteeringController({
  video: refs.headSteeringPreview ?? document.createElement('video'),
  onTarget(target) {
    if (state.mode === 'racing') state.playerTarget = target;
  },
  onStatus(status) {
    if (refs.headSteeringStatus) refs.headSteeringStatus.textContent = status.message;
    if (status.message === 'Centre position calibrated.' && state.mode === 'calibrating') {
      state.mode = headSteeringRaceMode(state.mode, 'calibrated');
      startRace();
    }
  },
});
const playerSprite = new Image();
let playerSpriteReady = false;
let pointerStartX = null;
let headSteeringRequestId = 0;

playerSprite.addEventListener('load', () => {
  playerSpriteReady = true;
  if (state.mode === 'racing') drawTrack();
});
playerSprite.src = './car.png';

function setStatus(message = '') {
  refs.status.textContent = message;
}

function setHeadSteeringControls(enabled) {
  refs.headSteeringPreview.hidden = !enabled;
  refs.enableHeadSteering.disabled = enabled;
  refs.calibrateHeadSteering.disabled = !enabled;
  refs.stopHeadSteering.disabled = !enabled;
}

function stopHeadSteering() {
  const wasCalibrating = state.mode === 'calibrating';
  headSteeringRequestId += 1;
  headSteering.stop();
  setHeadSteeringControls(false);
  if (wasCalibrating) startRace();
}

function pauseRaceForHeadCalibration() {
  if (state.mode !== 'racing') return false;
  cancelAnimationFrame(state.frameId);
  state.mode = headSteeringRaceMode(state.mode, 'enable');
  if (refs.headSteeringStatus) refs.headSteeringStatus.textContent = 'Preparing camera. Centre your head to calibrate.';
  return true;
}

function focusScreen(name) {
  const target = document.querySelector(`#${name}-screen h1`) || document.querySelector(`#${name}-screen button`);
  requestAnimationFrame(() => target?.focus());
}

function showScreen(name, { focus = true } = {}) {
  screens.forEach((screen) => { screen.hidden = screen.id !== `${name}-screen`; });
  state.mode = modeForScreen(name);
  document.body.classList.toggle('is-racing', name === 'race');
  if (name === 'start') refreshBestScore();
  if (focus) focusScreen(name);
}

function refreshBestScore() {
  try {
    const best = getBestScore();
    refs.bestScore.textContent = best ? best.toLocaleString() : '—';
  } catch {
    refs.bestScore.textContent = '—';
    setStatus('Saved scores are unavailable on this device.');
  }
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.max(1, Math.round(bounds.width));
  state.height = Math.max(1, Math.round(bounds.height));
  canvas.width = Math.round(state.width * ratio);
  canvas.height = Math.round(state.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function carBox(position, y, scale = 1) {
  const width = state.width / 3 * 0.55 * scale;
  const height = width * 1.62;
  const centerX = width / 2 + position * (state.width - width);
  return { x: centerX - width / 2, y, width, height };
}

function playerBox() {
  return carBox(state.playerPosition, playerStartY(state.height));
}

function coneBox(lane, y) {
  const width = state.width / 3 * 0.24;
  const height = width * 1.5;
  const x = lane * state.width / 3 + (state.width / 3 - width) / 2;
  return { x, y, width, height };
}

function drawPlayerCar(box) {
  const { x, y, width, height } = box;
  if (playerSpriteReady) {
    const { centerX, centerY, rotation } = playerSpriteTransform(box);
    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.drawImage(playerSprite, -width / 2, -height / 2, width, height);
    context.restore();
    return;
  }
  const body = context.createLinearGradient(x, y, x + width, y + height);
  body.addColorStop(0, '#ff5753');
  body.addColorStop(.5, '#d81927');
  body.addColorStop(1, '#870f22');
  const cockpit = context.createLinearGradient(x, y, x + width, y + height);
  cockpit.addColorStop(0, '#bfd7e5');
  cockpit.addColorStop(1, '#192b45');
  context.save();
  context.fillStyle = 'rgba(0, 0, 0, .22)';
  context.beginPath();
  context.ellipse(x + width * .53, y + height * .56, width * .4, height * .48, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#0b1421';
  context.fillRect(x + width * .02, y + height * .49, width * .19, height * .34);
  context.fillRect(x + width * .79, y + height * .49, width * .19, height * .34);
  context.fillStyle = '#1a2735';
  context.fillRect(x + width * .08, y + height * .04, width * .84, height * .1);
  context.fillStyle = body;
  context.fillRect(x + width * .18, y + height * .24, width * .64, height * .56);
  context.beginPath();
  context.moveTo(x + width * .23, y + height * .3);
  context.lineTo(x + width * .77, y + height * .3);
  context.lineTo(x + width * .62, y + height * .02);
  context.lineTo(x + width * .38, y + height * .02);
  context.closePath();
  context.fill();
  context.fillStyle = cockpit;
  context.beginPath();
  context.ellipse(x + width * .5, y + height * .35, width * .14, height * .17, 0, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f4f7f8';
  context.fillRect(x + width * .36, y + height * .16, width * .28, height * .035);
  context.fillStyle = '#f2b523';
  context.fillRect(x + width * .43, y + height * .51, width * .14, height * .26);
  context.fillStyle = '#f4f7f8';
  context.fillRect(x + width * .12, y + height * .84, width * .76, height * .08);
  context.restore();
}

function drawCone(box) {
  const { x, y, width, height } = box;
  context.save();
  context.fillStyle = 'rgba(0, 0, 0, .28)';
  context.beginPath();
  context.ellipse(x + width * .55, y + height * .9, width * .48, height * .14, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#d86017';
  context.fillRect(x + width * .04, y + height * .77, width * .92, height * .17);
  context.fillStyle = '#f78b24';
  context.beginPath();
  context.moveTo(x + width * .5, y + height * .03);
  context.lineTo(x + width * .84, y + height * .78);
  context.lineTo(x + width * .16, y + height * .78);
  context.closePath();
  context.fill();
  context.fillStyle = '#fff1d8';
  context.beginPath();
  context.moveTo(x + width * .31, y + height * .48);
  context.lineTo(x + width * .69, y + height * .48);
  context.lineTo(x + width * .75, y + height * .61);
  context.lineTo(x + width * .25, y + height * .61);
  context.closePath();
  context.fill();
  context.restore();
}

function drawTrack() {
  const { width, height } = state;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#95a9ae';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#1b2a3a';
  context.fillRect(width * .07, 0, width * .86, height);
  context.fillStyle = '#dce6e9';
  context.fillRect(width * .07, 0, width * .016, height);
  context.fillRect(width * .914, 0, width * .016, height);
  context.strokeStyle = 'rgba(236, 248, 248, .68)';
  context.lineWidth = Math.max(2, width * .009);
  context.setLineDash([height * .045, height * .035]);
  context.lineDashOffset = -(state.score * 4);
  for (let lane = 1; lane <= 2; lane += 1) {
    context.beginPath();
    context.moveTo((width / 3) * lane, 0);
    context.lineTo((width / 3) * lane, height);
    context.stroke();
  }
  context.setLineDash([]);
  for (let marker = 0; marker < 6; marker += 1) {
    const y = (marker * height / 5 + state.score * 7) % height;
    context.fillStyle = marker % 2 ? '#e9f0f2' : '#ed3d3d';
    context.fillRect(0, y, width * .07, height / 10);
    context.fillRect(width * .93, y, width * .07, height / 10);
  }
  state.obstacles.forEach(drawCone);
  drawPlayerCar(playerBox());
}

function addObstacle() {
  const firstLane = Math.floor(Math.random() * 3);
  const minimumGap = Math.max(150, state.height * .24);
  for (let offset = 0; offset < 3; offset += 1) {
    const box = coneBox((firstLane + offset) % 3, -state.height * .16);
    if (hasSafeObstacleGap(state.obstacles, box, minimumGap)) {
      state.obstacles.push(box);
      return;
    }
  }
}

function moveLane(amount) {
  if (state.mode !== 'racing') return;
  const nextLane = Math.round(state.playerTarget * 2) + amount;
  state.playerTarget = laneTarget(nextLane);
  drawTrack();
}

function tick(timestamp) {
  if (state.mode !== 'racing') return;
  const delta = Math.min(50, timestamp - state.lastFrame || 16);
  state.lastFrame = timestamp;
  state.playerPosition = easeToward(
    state.playerPosition,
    state.playerTarget,
    Math.min(1, delta / 90),
  );
  state.score = Math.floor((timestamp - state.startedAt) / 100);
  const speed = 255 + state.score * .6;
  state.obstacles.forEach((obstacle) => { obstacle.y += speed * (delta / 1000); });
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.y < state.height + obstacle.height);
  if (timestamp >= state.spawnAt) {
    addObstacle();
    state.spawnAt = timestamp + 1350 + Math.random() * 550;
  }
  refs.score.textContent = state.score.toLocaleString();
  drawTrack();
  if (state.obstacles.some((obstacle) => hasCollision(playerBox(), obstacle))) {
    endRace();
    return;
  }
  state.frameId = requestAnimationFrame(tick);
}

export function startRace() {
  cancelAnimationFrame(state.frameId);
  setStatus();
  state.playerTarget = .5;
  state.playerPosition = .5;
  state.obstacles = [];
  state.score = 0;
  state.lastFrame = 0;
  showScreen('race');
  resizeCanvas();
  const now = performance.now();
  state.startedAt = now;
  state.spawnAt = now + 1200;
  refs.score.textContent = '0';
  drawTrack();
  state.frameId = requestAnimationFrame(tick);
}

export function endRace() {
  if (state.mode !== 'racing') return;
  cancelAnimationFrame(state.frameId);
  stopHeadSteering();
  refs.finalScore.textContent = state.score.toLocaleString();
  showScreen('gameover');
}

function renderLeaderboard() {
  refs.leaderboard.replaceChildren();
  try {
    const scores = loadScores();
    if (!scores.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No saved laps yet. Start a race to set the first record.';
      refs.leaderboard.append(empty);
      return;
    }
    scores.forEach((entry, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      const name = document.createElement('span');
      const points = document.createElement('span');
      rank.className = 'rank'; name.className = 'driver'; points.className = 'points';
      rank.textContent = String(index + 1).padStart(2, '0');
      name.textContent = entry.name;
      points.textContent = `${entry.score.toLocaleString()} pts`;
      row.append(rank, name, points);
      refs.leaderboard.append(row);
    });
  } catch {
    setStatus('Could not load saved scores on this device.');
  }
}

export function showLeaderboard() {
  cancelAnimationFrame(state.frameId);
  stopHeadSteering();
  renderLeaderboard();
  showScreen('leaderboard');
}

document.querySelector('#start-button').addEventListener('click', startRace);
document.querySelector('#retry-button').addEventListener('click', startRace);
document.querySelectorAll('.leaderboard-link').forEach((button) => button.addEventListener('click', showLeaderboard));
document.querySelector('#back-to-start').addEventListener('click', () => {
  stopHeadSteering();
  setStatus();
  showScreen('start');
});
refs.left.addEventListener('click', () => moveLane(-1));
refs.right.addEventListener('click', () => moveLane(1));
refs.enableHeadSteering.addEventListener('click', async () => {
  if (!pauseRaceForHeadCalibration()) return;
  const requestId = ++headSteeringRequestId;
  refs.enableHeadSteering.disabled = true;
  try {
    await headSteering.start();
    if (requestId !== headSteeringRequestId || !isHeadSteeringActiveMode(state.mode)) {
      stopHeadSteering();
      return;
    }
    setHeadSteeringControls(true);
  } catch {
    setHeadSteeringControls(false);
    if (state.mode === 'calibrating') startRace();
  }
});
refs.calibrateHeadSteering.addEventListener('click', () => headSteering.calibrate());
refs.stopHeadSteering.addEventListener('click', stopHeadSteering);

document.addEventListener('keydown', (event) => {
  const direction = raceInputDirection(state.mode, event.key);
  if (direction) {
    event.preventDefault();
    moveLane(direction);
  }
});
canvas.addEventListener('pointerdown', (event) => { pointerStartX = event.clientX; });
canvas.addEventListener('pointerup', (event) => {
  if (pointerStartX === null) return;
  const shift = event.clientX - pointerStartX;
  pointerStartX = null;
  if (Math.abs(shift) >= 35) moveLane(shift > 0 ? 1 : -1);
});
canvas.addEventListener('pointercancel', () => { pointerStartX = null; });
window.addEventListener('resize', () => {
  if (state.mode === 'racing') { resizeCanvas(); drawTrack(); }
});

refs.form.addEventListener('submit', (event) => {
  event.preventDefault();
  setStatus('Saving score…');
  refs.save.disabled = true;
  try {
    const saved = saveScore(undefined, refs.name.value, state.score);
    const name = saved.find((entry) => entry.name.toLocaleLowerCase() === refs.name.value.trim().toLocaleLowerCase())?.name;
    refs.form.reset();
    setStatus(`Saved — ${name} is now on the leaderboard.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save your score on this device.');
  } finally {
    refs.save.disabled = false;
  }
});

if (!context) {
  setStatus('Your browser cannot draw the race track.');
} else {
  showScreen('start', { focus: false });
}
