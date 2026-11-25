#!/usr/bin/env node
// Fails when a file contains git merge-conflict markers such as
// `<<<<<<< HEAD` or `>>>>>>> origin/main` (the branch name is optional).
//
// Usage:
//   node scripts/check-conflict-markers.js --staged  # staged content (pre-commit)
//   node scripts/check-conflict-markers.js           # all tracked files (CI)

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

// Seven `<` or `>` at the start of a line, followed by a space or end of line.
const MARKER = /^(<{7}|>{7})(\s|$)/m;

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(Boolean);

const staged = process.argv.includes('--staged');
const files = staged
  ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  : git(['ls-files']);

const offenders = [];
for (const file of files) {
  // In pre-commit, check what is about to be committed (the index), not the
  // working tree, which may hold unstaged edits.
  const content = staged
    ? execFileSync('git', ['show', `:${file}`], {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
      })
    : fs.readFileSync(file, 'utf8');
  if (MARKER.test(content)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error('Merge conflict markers found in:');
  for (const file of offenders) console.error(`  ${file}`);
  process.exit(1);
}
