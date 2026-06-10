const fs = require('node:fs/promises');
const path = require('node:path');

const LAUNCHER_CONFIG_FILE_NAME = 'launcher-config.json';

function getLauncherConfigPath({ userDataDir }) {
  if (typeof userDataDir !== 'string' || userDataDir.trim() === '') {
    throw new Error('userDataDir must be a non-empty string');
  }

  return path.join(userDataDir, LAUNCHER_CONFIG_FILE_NAME);
}

async function readConfigDocument(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeConfigDocument(filePath, doc) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf8');
}

module.exports = {
  getLauncherConfigPath,
  readConfigDocument,
  writeConfigDocument,
};
