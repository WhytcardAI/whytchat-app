#!/usr/bin/env node
/* eslint-env node */
// i18n key parity check for WhytChat desktop app
// Canonical locale: en; Supported: en, fr, es, de, it, pt, nl, pl

const fs = require("fs");
const path = require("path");

// Using process.cwd() instead of __dirname to avoid no-undef lint issues when __dirname is not defined.
const localesRoot = path.resolve(process.cwd(), "src", "locales");
const canonical = "en";

/**
 * Validates that a locale name is safe to use in file paths.
 * Prevents path traversal attacks by rejecting unsafe characters and path segments.
 * @param {string} locale - The locale name to validate
 * @returns {boolean} - True if the locale is valid, false otherwise
 */
function isValidLocaleName(locale) {
  // Reject null, undefined, or non-string values
  if (!locale || typeof locale !== "string") return false;
  
  // Reject absolute paths
  if (path.isAbsolute(locale)) return false;
  
  // Reject parent directory references and other unsafe patterns
  const unsafePatterns = ["..", "~", "/", "\\", "\0"];
  if (unsafePatterns.some((pattern) => locale.includes(pattern))) return false;
  
  // Only allow alphanumeric characters, hyphens, and underscores
  // This is a whitelist approach for locale names (e.g., "en", "en-US", "zh_CN")
  if (!/^[a-zA-Z0-9_-]+$/.test(locale)) return false;
  
  return true;
}

/**
 * Validates that a resolved file path is within the allowed base directory.
 * @param {string} filePath - The file path to validate
 * @param {string} baseDir - The base directory that the file must be within
 * @returns {boolean} - True if the path is safe, false otherwise
 */
function isPathWithinBase(filePath, baseDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  
  // Ensure the resolved path starts with the base directory
  // Use path separator to prevent partial matches (e.g., /app/locales vs /app/locales-backup)
  return resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase;
}

function readJson(fp) {
  // Validate that the file path is within the locales directory
  if (!isPathWithinBase(fp, localesRoot)) {
    throw new Error(`Invalid file path: path is outside allowed directory`);
  }
  
  let raw;
  try {
    raw = fs.readFileSync(fp, "utf8");
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
  if (!fs.existsSync(localesRoot)) {
    console.error(`Locales folder not found: ${localesRoot}`);
    process.exit(2);
  }
  return fs
    .readdirSync(localesRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => path.basename(d.name, ".json"))
    .sort();
}

function loadLocale(locale) {
  // Validate locale name to prevent path traversal
  if (!isValidLocaleName(locale)) {
    throw new Error(`Invalid locale name: ${locale}`);
  }
  
  // Use path.resolve to normalize the path and then validate it
  const fp = path.resolve(localesRoot, `${locale}.json`);
  
  // Ensure the resolved path is within the locales directory
  if (!isPathWithinBase(fp, localesRoot)) {
    throw new Error(`Invalid file path for locale '${locale}': path is outside allowed directory`);
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
