#!/usr/bin/env node
/* eslint-disable */
/* Simple version parity check between package.json and src-tauri/tauri.conf.json */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const pkgPath = resolve(process.cwd(), 'package.json');
const tauriPath = resolve(process.cwd(), 'src-tauri', 'tauri.conf.json');

try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'));
  const pv = (pkg.version || '').trim();
  const tv = (tauri.version || '').trim();

  if (!pv || !tv) {
    console.error('[check-version] Missing version in package.json or tauri.conf.json');
    process.exit(1);
  }

  if (pv !== tv) {
    console.error(`[check-version] Version mismatch: package.json=${pv} vs tauri.conf.json=${tv}`);
    process.exit(1);
  }

  console.log(`[check-version] OK: version ${pv}`);
} catch (e) {
  console.error('[check-version] Failed:', (e && e.message) || e);
  process.exit(1);
}
