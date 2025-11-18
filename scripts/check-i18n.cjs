#!/usr/bin/env node
/* eslint-env node */
// i18n key parity check for WhytChat desktop app
// Canonical locale: en; Supported: en, fr, es, de, it, pt, nl, pl

const fs = require("fs");
const path = require("path");

// Using process.cwd() instead of __dirname to avoid no-undef lint issues when __dirname is not defined.
const localesRoot = path.normalize(
  path.resolve(process.cwd(), "src", "locales")
);
const canonical = "en";
const allowedLocales = ["en", "fr", "es", "de", "it", "pt", "nl", "pl"];

function isPathSafe(filePath, baseDir) {
  const normalized = path.normalize(path.resolve(baseDir, filePath));
  return normalized.startsWith(baseDir);
}

function readJson(fp) {
  const normalizedPath = path.normalize(fp);
  if (!isPathSafe(normalizedPath, localesRoot)) {
    throw new Error(`Path traversal detected: ${fp}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(normalizedPath, "utf8");
  } catch (e) {
    throw new Error(`Cannot read file '${fp}': ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in '${fp}': ${e.message}`);
  }
}

function collectKeys(obj, prefix = "") {
  const keys = new Map();
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      keys.set(p, Array.isArray(v) ? "array" : typeof v);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [childK, t] of collectKeys(v, p)) keys.set(childK, t);
      }
    }
  }
  return keys;
}

function diffKeys(baseKeys, otherKeys) {
  const missing = [];
  const extra = [];
  const mismatchedTypes = [];
  for (const [k, t] of baseKeys.entries()) {
    if (!otherKeys.has(k)) missing.push(k);
    else if (otherKeys.get(k) !== t)
      mismatchedTypes.push([k, t, otherKeys.get(k)]);
  }
  for (const k of otherKeys.keys()) {
    if (!baseKeys.has(k)) extra.push(k);
  }
  return { missing, extra, mismatchedTypes };
}

function getLocales() {
  const normalizedRoot = path.normalize(localesRoot);
  if (!fs.existsSync(normalizedRoot)) {
    console.error(`Locales folder not found: ${normalizedRoot}`);
    process.exit(2);
  }
  return fs
    .readdirSync(normalizedRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => path.basename(d.name, ".json"))
    .filter((locale) => allowedLocales.includes(locale))
    .sort();
}

function loadLocale(locale) {
  if (!allowedLocales.includes(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }
  const safeName = locale.replace(/[^a-z]/g, "");
  const fp = path.normalize(path.join(localesRoot, `${safeName}.json`));
  if (!isPathSafe(fp, localesRoot)) {
    throw new Error(`Path traversal detected for locale: ${locale}`);
  }
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing translation file for ${locale}: ${fp}`);
  }
  return readJson(fp);
}

function main() {
  const locales = getLocales();
  if (!locales.includes(canonical)) {
    console.error(
      `Canonical locale '${canonical}' not found in ${localesRoot}`
    );
    process.exit(2);
  }

  const base = loadLocale(canonical);
  const baseKeys = collectKeys(base);
  let hasErrors = false;
  for (const locale of locales) {
    if (locale === canonical) continue;
    try {
      const other = loadLocale(locale);
      const otherKeys = collectKeys(other);
      const { missing, extra, mismatchedTypes } = diffKeys(baseKeys, otherKeys);
      if (missing.length || extra.length || mismatchedTypes.length) {
        hasErrors = true;
        console.error(`\nLocale '${locale}' differs from '${canonical}':`);
        if (missing.length)
          console.error(
            `  Missing keys (${missing.length}):\n    - ${missing.join("\n    - ")}`
          );
        if (extra.length)
          console.error(
            `  Extra keys (${extra.length}):\n    - ${extra.join("\n    - ")}`
          );
        if (mismatchedTypes.length) {
          console.error("  Type mismatches:");
          for (const [k, expected, got] of mismatchedTypes) {
            console.error(`    - ${k}: expected ${expected}, got ${got}`);
          }
        }
      } else {
        console.log(`Locale '${locale}': OK`);
      }
    } catch (e) {
      hasErrors = true;
      console.error(`Error checking locale '${locale}': ${e.message}`);
    }
  }

  if (hasErrors) {
    console.error("\n❌ i18n parity check failed");
    process.exit(1);
  } else {
    console.log("\n✅ i18n parity check passed");
  }
}

main();
