#!/usr/bin/env node
// Builds release notes in Markdown from the git history between the previous
// release tag and the given tag.
//
// Usage: node scripts/generate-changelog.mjs <tag> [outFile]
// Env:   GITHUB_REPOSITORY (owner/name) enables commit and compare links.
//
// Commits that follow Conventional Commits (feat:, fix:, ...) are grouped by
// type. Everything else lands under "Other changes", so loose messages like
// "Web changes" still show up.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const tag = process.argv[2];
const outFile = process.argv[3];

if (!tag) {
  console.error('Usage: node scripts/generate-changelog.mjs <tag> [outFile]');
  process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY || '';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const tryGit = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// Previous release: nearest earlier v* tag, then any tag, else the whole history.
const previousTag =
  tryGit('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', `${tag}^`) ||
  tryGit('describe', '--tags', '--abbrev=0', `${tag}^`);

const range = previousTag ? `${previousTag}..${tag}` : tag;
const raw = git('log', range, '--no-merges', '--pretty=format:%H%x1f%an%x1f%s');
const commits = raw
  ? raw.split('\n').map((line) => {
      const [hash, author, subject] = line.split('\x1f');
      return { hash, author, subject };
    })
  : [];

const SECTIONS = [
  { key: 'feat', title: '✨ New features' },
  { key: 'fix', title: '🐛 Bug fixes' },
  { key: 'perf', title: '⚡ Performance' },
  { key: 'refactor', title: '♻️ Refactoring' },
  { key: 'docs', title: '📚 Documentation' },
  { key: 'build', title: '📦 Build & CI' },
  { key: 'ci', title: '📦 Build & CI' },
  { key: 'test', title: '🧪 Tests' },
  { key: 'style', title: '🎨 Style' },
  { key: 'chore', title: '🧹 Maintenance' },
  { key: 'other', title: '🔧 Other changes' },
];

const CONVENTIONAL = /^(feat|fix|perf|refactor|docs|build|ci|test|style|chore)(\(([^)]+)\))?(!)?:\s*(.+)$/i;

const groups = new Map();
for (const { hash, author, subject } of commits) {
  const m = CONVENTIONAL.exec(subject);
  const key = m ? m[1].toLowerCase() : 'other';
  const title = SECTIONS.find((s) => s.key === key).title;
  const scope = m && m[3] ? `**${m[3]}:** ` : '';
  const breaking = m && m[4] ? ' ⚠️ **BREAKING**' : '';
  const text = m ? m[5] : subject;
  const short = hash.slice(0, 7);
  const ref = repo ? `[\`${short}\`](https://github.com/${repo}/commit/${hash})` : `\`${short}\``;
  if (!groups.has(title)) groups.set(title, []);
  groups.get(title).push(`- ${scope}${text}${breaking} (${ref}, ${author})`);
}

const lines = [];
lines.push(`## What's changed in ${tag}`, '');

if (commits.length === 0) {
  lines.push('_No code changes since the previous release._', '');
} else {
  const seen = new Set();
  for (const { title } of SECTIONS) {
    if (seen.has(title) || !groups.has(title)) continue;
    seen.add(title);
    lines.push(`### ${title}`, '', ...groups.get(title), '');
  }
  const authors = [...new Set(commits.map((c) => c.author))];
  lines.push(`### 👥 Contributors`, '', authors.map((a) => `- ${a}`).join('\n'), '');
}

lines.push('### 📥 Install', '');
lines.push('Download the Windows installer (`.exe` or `.msi`) from the assets below. Existing installs can update from inside Kivo.', '');

if (repo && previousTag) {
  lines.push(`**Full changelog:** https://github.com/${repo}/compare/${previousTag}...${tag}`, '');
}

const out = lines.join('\n');
if (outFile) writeFileSync(outFile, out);
else process.stdout.write(out);
