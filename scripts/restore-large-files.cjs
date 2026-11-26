'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { createReadStream } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const partsRoot = path.join(root, 'source-parts');
const readOptions = { highWaterMark: 1024 * 1024 };
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

async function loadManifest() {
  const manifest = JSON.parse(await fs.readFile(path.join(partsRoot, 'manifest.json'), 'utf8'));
  if (!Number.isSafeInteger(manifest.chunkSize) || manifest.chunkSize <= 0 ||
      !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('Invalid source-parts manifest.');
  }

  const seen = new Set();
  for (const file of manifest.files) {
    const name = file?.path;
    if (typeof name !== 'string' || /[\\:\0]/.test(name) ||
        name.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
      throw new Error('Invalid original file path in the source-parts manifest.');
    }
    const key = process.platform === 'win32' ? name.toLowerCase() : name;
    if (seen.has(key) || !Number.isSafeInteger(file.size) || file.size <= 0 ||
        ![0o644, 0o755].includes(file.mode) || !isDigest(file.sha256) ||
        !Array.isArray(file.parts) || file.parts.length !== Math.ceil(file.size / manifest.chunkSize) ||
        !file.parts.every(isDigest)) {
      throw new Error('Invalid source-parts entry for ' + name);
    }
    seen.add(key);
  }
  return manifest;
}

async function existingOriginal(file) {
  const target = path.join(root, file.path);
  let info;
  try {
    info = await fs.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const mismatch = 'Existing original differs from manifest: ' + file.path;
  if (!info.isFile() || info.size !== file.size) throw new Error(mismatch);
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(target, readOptions)) hash.update(bytes);
  if (hash.digest('hex') !== file.sha256) throw new Error(mismatch);
  return info;
}

async function streamParts(file, chunkSize, output) {
  const whole = createHash('sha256');
  for (const [index, digest] of file.parts.entries()) {
    const suffix = String(index + 1).padStart(3, '0');
    const name = file.path + '.part' + suffix;
    const expectedSize = Math.min(chunkSize, file.size - index * chunkSize);
    const part = createHash('sha256');
    let size = 0;
    for await (const bytes of createReadStream(path.join(partsRoot, name), readOptions)) {
      size += bytes.length;
      if (size > expectedSize) throw new Error('Incorrect part size: ' + name);
      part.update(bytes);
      whole.update(bytes);
      if (output) await output.writeFile(bytes);
    }
    if (size !== expectedSize || part.digest('hex') !== digest) {
      throw new Error('Source part failed verification: ' + name);
    }
  }
  if (whole.digest('hex') !== file.sha256) {
    throw new Error('Combined parts failed verification: ' + file.path);
  }
}

async function restoreFile(file, chunkSize) {
  const target = path.join(root, file.path);
  const existing = await existingOriginal(file);
  if (existing) {
    if (process.platform !== 'win32' && file.mode === 0o755 && !(existing.mode & 0o100)) {
      await fs.chmod(target, file.mode);
    }
    return;
  }

  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, '.restore-' + randomUUID() + '.tmp');
  const output = await fs.open(temporary, 'wx', 0o600);
  try {
    try {
      await streamParts(file, chunkSize, output);
      if (process.platform !== 'win32') await output.chmod(file.mode);
      await output.sync();
    } finally {
      await output.close();
    }
    // Publishing a hard link is atomic and cannot replace a concurrently created original.
    try {
      await fs.link(temporary, target);
    } catch (error) {
      if (error.code !== 'EEXIST' || !(await existingOriginal(file))) throw error;
    }
  } finally {
    await fs.unlink(temporary);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--verify')) {
    throw new Error('Usage: node scripts/restore-large-files.cjs [--verify]');
  }
  const verify = args[0] === '--verify';
  const { files, chunkSize } = await loadManifest();
  for (const file of files) {
    if (verify) {
      await streamParts(file, chunkSize);
      await existingOriginal(file);
    } else {
      await restoreFile(file, chunkSize);
    }
  }
  console.log(verify ? 'Verified all large-file parts.' : 'All large source files are ready.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
