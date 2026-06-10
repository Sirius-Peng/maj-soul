const path = require('node:path');

const { MajsoulDb } = require('../src/db/majsoulDb');

function parseArgs(argv) {
  const args = {
    command: null,
    dbPath: null,
    start: null,
    end: null,
  };

  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') {
      args.dbPath = argv[i + 1] ?? null;
      i++;
      continue;
    }
    if (a === '--start') {
      args.start = argv[i + 1] ?? null;
      i++;
      continue;
    }
    if (a === '--end') {
      args.end = argv[i + 1] ?? null;
      i++;
      continue;
    }
    rest.push(a);
  }

  args.command = rest[0] ?? null;
  return args;
}

function printUsage() {
  const lines = [];
  lines.push(`Usage:`);
  lines.push(`  node scripts/query.js --db <path> --start <iso> --end <iso> sessions`);
  lines.push(`  node scripts/query.js --db <path> --start <iso> --end <iso> keyframes`);
  lines.push(``);
  lines.push(`Examples:`);
  lines.push(
    `  node scripts/query.js --db artifacts/majsoul.sqlite --start 2026-06-10T00:00:00.000Z --end 2026-06-10T23:59:59.999Z sessions`,
  );
  lines.push(
    `  node scripts/query.js --db artifacts/majsoul.sqlite --start 2026-06-10T00:00:00.000Z --end 2026-06-10T23:59:59.999Z keyframes`,
  );
  console.log(lines.join('\n'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dbPath || !args.start || !args.end || !args.command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const dbPath = path.resolve(process.cwd(), args.dbPath);
  const db = new MajsoulDb(dbPath);
  try {
    if (args.command === 'sessions') {
      console.log(JSON.stringify(db.listSessionsByTime(args.start, args.end), null, 2));
      return;
    }
    if (args.command === 'keyframes') {
      console.log(JSON.stringify(db.listKeyframesByTime(args.start, args.end), null, 2));
      return;
    }

    printUsage();
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
