const fs = require('node:fs/promises');
const path = require('node:path');

const { runBenchCases } = require('../src/bench/benchRunner');

async function loadCases(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b));

  const cases = [];
  for (const f of files) {
    const raw = JSON.parse(await fs.readFile(f, 'utf8'));
    cases.push(raw);
  }
  return cases;
}

function formatMd(report) {
  const lines = [];
  lines.push(`# Bench Report`);
  lines.push(``);
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- DurationMs: ${report.summary.durationMs}`);
  lines.push(``);
  lines.push(`| Case | OK | DurationMs | Diff |`);
  lines.push(`| --- | --- | ---: | --- |`);
  for (const c of report.cases) {
    const diff = c.ok ? '' : `${c.diff?.path ?? ''}`;
    lines.push(`| ${c.id} | ${c.ok ? 'Y' : 'N'} | ${c.durationMs} | ${diff} |`);
  }
  lines.push(``);
  for (const c of report.cases) {
    if (c.ok) continue;
    lines.push(`## ${c.id}`);
    lines.push(``);
    lines.push(`- DiffPath: ${c.diff?.path ?? ''}`);
    if (c.diff?.expected !== undefined || c.diff?.actual !== undefined) {
      lines.push(``);
      lines.push(`\`\`\`json`);
      lines.push(
        JSON.stringify(
          { expected: c.diff.expected ?? null, actual: c.diff.actual ?? null },
          null,
          2
        )
      );
      lines.push(`\`\`\``);
    } else if (c.diff?.message) {
      lines.push(``);
      lines.push(`\`\`\``);
      lines.push(String(c.diff.message));
      lines.push(`\`\`\``);
    }
    lines.push(``);
  }
  return lines.join('\n');
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const casesDir = path.join(repoRoot, 'bench', 'cases');
  const outDir = path.join(repoRoot, 'artifacts', 'bench');
  await fs.mkdir(outDir, { recursive: true });

  const cases = await loadCases(casesDir);
  const report = runBenchCases({ cases });

  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outDir, 'report.md'), formatMd(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

