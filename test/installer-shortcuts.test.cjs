'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tauri = path.join(__dirname, '..', 'src-tauri');

test('NSIS creates the Start Menu launcher and never offers or writes a Desktop link', () => {
  const config = JSON.parse(fs.readFileSync(path.join(tauri, 'tauri.windows.conf.json'), 'utf8'));
  const template = fs.readFileSync(path.join(tauri, config.bundle.windows.nsis.template), 'utf8');
  const instructions = template.split(/\r?\n/).map(line => line.split(';')[0].trim());
  const shortcuts = instructions.filter(line => /^CreateShortCut\s/i.test(line));
  assert.ok(shortcuts.length, 'The installer should register a Start Menu launcher');
  for (const line of shortcuts) assert.match(line, /^CreateShortCut\s+"\$SMPROGRAMS\\/i);
  assert.ok(instructions.includes('Call CreateOrUpdateStartMenuShortcut'));
  assert.doesNotMatch(instructions.join('\n'), /\$\(createDesktop\)|CreateOrUpdateDesktopShortcut|SetShortcutTarget "\$DESKTOP/i);
});
