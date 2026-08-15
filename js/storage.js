export const LEADERBOARD_KEY = 'f1racer.leaderboard.v1';

const byScore = (left, right) => right.score - left.score || left.name.localeCompare(right.name);

function resolveStorage(storage) {
  if (storage) return storage;
  if (globalThis.localStorage) return globalThis.localStorage;
  throw new Error('Score storage is unavailable on this device.');
}

function isValidRecord(record) {
  return Boolean(
    record
      && typeof record.name === 'string'
      && record.name.trim()
      && Number.isFinite(record.score)
      && record.score >= 0,
  );
}

export function loadScores(storage) {
  const store = resolveStorage(storage);
  let parsed;

  try {
    const raw = store.getItem(LEADERBOARD_KEY);
    parsed = raw ? JSON.parse(raw) : [];
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isValidRecord)
    .map(({ name, score }) => ({ name: name.trim(), score: Math.floor(score) }))
    .sort(byScore);
}

export function saveScore(storage, name, score) {
  const store = resolveStorage(storage);
  const cleanedName = String(name ?? '').trim().slice(0, 24);
  const cleanedScore = Math.floor(Number(score));

  if (!cleanedName || !Number.isFinite(cleanedScore) || cleanedScore < 0) {
    throw new Error('Enter a valid name and score.');
  }

  const normalizedName = cleanedName.toLocaleLowerCase();
  const records = loadScores(store).filter(
    (entry) => entry.name.toLocaleLowerCase() !== normalizedName,
  );
  const next = [...records, { name: cleanedName, score: cleanedScore }].sort(byScore);
  store.setItem(LEADERBOARD_KEY, JSON.stringify(next));
  return next;
}

export function getBestScore(storage) {
  return loadScores(storage)[0]?.score ?? 0;
}
