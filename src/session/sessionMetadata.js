const fs = require('node:fs/promises');
const path = require('node:path');

function buildEmptySessionDocument(meta) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    meta,
    games: [],
    keyframes: [],
    errors: [],
    stats: {
      gameCount: 0,
      keyframeCount: 0,
      errorCount: 0,
    },
  };
}

async function readSessionDocument(metaPath) {
  const raw = await fs.readFile(metaPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && typeof parsed.schemaVersion === 'number') return parsed;
  return buildEmptySessionDocument(parsed);
}

async function writeSessionMetadata(metaPath, meta) {
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  let doc;
  try {
    doc = await readSessionDocument(metaPath);
  } catch {
    doc = buildEmptySessionDocument(meta);
  }
  doc.meta = meta;
  doc.generatedAt = new Date().toISOString();
  await fs.writeFile(metaPath, JSON.stringify(doc, null, 2), 'utf8');
}

async function readSessionMetadata(metaPath) {
  const doc = await readSessionDocument(metaPath);
  return doc.meta;
}

module.exports = {
  buildEmptySessionDocument,
  readSessionMetadata,
  readSessionDocument,
  writeSessionMetadata,
};
