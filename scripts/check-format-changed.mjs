import { execSync } from 'node:child_process';

function git(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

// In GitHub PR runs we can rely on GITHUB_BASE_REF being set.
const baseRef = process.env.GITHUB_BASE_REF;
const headSha = process.env.GITHUB_SHA;

let baseCommit;
if (baseRef && headSha) {
  baseCommit = git(`git merge-base origin/${baseRef} ${headSha}`);
} else {
  // Fallback (push builds): compare with previous commit.
  baseCommit = git('git rev-parse HEAD~1');
}

const changedFilesRaw = git(`git diff --name-only ${baseCommit}...HEAD`);
const changedFiles = changedFilesRaw ? changedFilesRaw.split('\n').filter(Boolean) : [];

// Only guard TS source we care about.
const candidates = changedFiles.filter((f) => f.endsWith('.ts') && f.startsWith('js/'));

if (!candidates.length) {
  console.log('[check-format-changed] no relevant changed js/**/*.ts files');
  process.exit(0);
}

console.log('[check-format-changed] checking', candidates.length, 'files');
// Prettier is a dev dependency already.
execSync(`npx prettier ${candidates.join(' ')} --check`, {
  stdio: 'inherit',
});

