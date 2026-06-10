const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadTemplateBankFromDir } = require('../src/vision/templateBank');

test('loadTemplateBankFromDir: preserves explicit alpha 0 values', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-template-bank-'));
  const filePath = path.join(dir, 'bank.json');
  await fs.writeFile(
    filePath,
    JSON.stringify({
      tiles: [{ id: 'transparent', rgba: [10, 20, 30, 0] }],
    }),
  );

  const bank = await loadTemplateBankFromDir(dir);
  assert.equal(bank.tiles.length, 1);
  assert.deepEqual(bank.tiles[0], { id: 'transparent', rgba: [10, 20, 30, 0] });
});
