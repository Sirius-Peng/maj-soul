const fs = require('node:fs/promises');
const path = require('node:path');

function normalizeEntry(e) {
  if (!e || typeof e.id !== 'string' || !Array.isArray(e.rgba) || e.rgba.length < 3) return null;
  const rgba = [
    Number.isFinite(Number(e.rgba[0])) ? Number(e.rgba[0]) : 0,
    Number.isFinite(Number(e.rgba[1])) ? Number(e.rgba[1]) : 0,
    Number.isFinite(Number(e.rgba[2])) ? Number(e.rgba[2]) : 0,
    Number.isFinite(Number(e.rgba[3])) ? Number(e.rgba[3]) : 255,
  ];
  return { id: e.id, rgba };
}

function mergeBank(target, src) {
  if (!src || typeof src !== 'object') return target;
  if (Array.isArray(src.tiles)) {
    for (const e of src.tiles) {
      const ne = normalizeEntry(e);
      if (ne) target.tiles.push(ne);
    }
  }
  if (Array.isArray(src.digits)) {
    for (const e of src.digits) {
      const ne = normalizeEntry(e);
      if (ne) target.digits.push(ne);
    }
  }
  return target;
}

async function loadTemplateBankFromDir(dir) {
  if (!dir) return { tiles: [], digits: [] };
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { tiles: [], digits: [] };
  }

  const bank = { tiles: [], digits: [] };
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.json')) continue;
    const filePath = path.join(dir, ent.name);
    let raw;
    try {
      raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      continue;
    }
    mergeBank(bank, raw);
  }
  return bank;
}

module.exports = {
  loadTemplateBankFromDir,
};
