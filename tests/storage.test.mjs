import test from 'node:test';
import assert from 'node:assert/strict';
import { getBestScore, loadScores, saveScore } from '../js/storage.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('returns an empty leaderboard for absent or malformed data', () => {
  assert.deepEqual(loadScores(memoryStorage()), []);
  assert.deepEqual(loadScores(memoryStorage({ 'f1racer.leaderboard.v1': '{broken' })), []);
});

test('replaces a case-insensitive name and sorts scores descending', () => {
  const storage = memoryStorage();
  saveScore(storage, 'Ana', 12);
  saveScore(storage, 'Mo', 28);
  assert.deepEqual(saveScore(storage, ' ana ', 42), [
    { name: 'ana', score: 42 },
    { name: 'Mo', score: 28 },
  ]);
  assert.equal(getBestScore(storage), 42);
});

test('rejects empty names and ignores invalid stored records', () => {
  const storage = memoryStorage({
    'f1racer.leaderboard.v1': JSON.stringify([
      { name: 'Valid', score: 5 },
      { name: '', score: 99 },
      { name: 'Negative', score: -1 },
    ]),
  });
  assert.deepEqual(loadScores(storage), [{ name: 'Valid', score: 5 }]);
  assert.throws(() => saveScore(storage, '   ', 10), /valid name/i);
});
