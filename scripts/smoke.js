const { spawnSync } = require('node:child_process');
const path = require('node:path');

function main() {
  const repoRoot = path.join(__dirname, '..');
  const env = { ...process.env, MAJSOUL_SMOKE: '1' };
  const args = ['--test', path.join(repoRoot, 'test', 'smokeOnline.test.js')];
  const res = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit', env });
  process.exitCode = res.status ?? 1;
}

main();

