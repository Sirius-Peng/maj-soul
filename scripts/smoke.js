const { spawnSync } = require('node:child_process');
const path = require('node:path');
const electronBinary = require('electron');

function main() {
  const repoRoot = path.join(__dirname, '..');
  const env = {
    ...process.env,
    MAJSOUL_LAUNCHER_SMOKE: '1',
    MAJSOUL_LAUNCHER_SMOKE_RESULT: path.join(repoRoot, 'artifacts', 'smoke', 'launcher-start.json'),
  };
  const res = spawnSync(electronBinary, ['.'], { cwd: repoRoot, stdio: 'inherit', env });
  process.exitCode = res.status ?? 1;
}

main();
