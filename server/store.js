'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const WORKS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'works');

// Ensure required directories exist on startup.
function ensureDirs() {
  [DATA_DIR, UPLOADS_DIR, WORKS_UPLOAD_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

// Read a JSON file, returning `fallback` if it does not exist or is corrupt.
function readJSON(name, fallback) {
  const fp = filePath(name);
  try {
    if (!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[store] Failed to read ${name}:`, err.message);
    return fallback;
  }
}

// Atomically write a JSON file (write to temp then rename).
function writeJSON(name, data) {
  ensureDirs();
  const fp = filePath(name);
  const tmp = `${fp}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fp);
}

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  WORKS_UPLOAD_DIR,
  ensureDirs,
  readJSON,
  writeJSON,
};
