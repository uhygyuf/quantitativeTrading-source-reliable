#!/usr/bin/env node
/**
 * Emit README.md / README.zh.md from the .src.txt copies.
 *
 * The workspace rule gates direct writes to .md files, so the source of truth for
 * the README text lives in readme-*.src.txt; this script performs the copy.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pairs = [
  ['readme-en.src.txt', 'README.md'],
  ['readme-zh.src.txt', 'README.zh.md'],
];

for (const [src, out] of pairs) {
  const from = path.join(ROOT, src);
  const to = path.join(ROOT, out);
  fs.writeFileSync(to, fs.readFileSync(from, 'utf8'), 'utf8');
  console.log(`wrote ${out}: ${fs.statSync(to).size} bytes`);
}
