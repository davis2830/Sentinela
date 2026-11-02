import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sensitive = /(?:PASSWORD|SECRET_KEY|(?:^|_)TOKEN$|API_KEY|EMAIL_HOST_USER)/i;
const placeholder = /^(?:|change-me[^\s]*|replace[-_].*|your[-_].*|example[^\s]*|<[^>]+>|\$\{[^}]+\})$/i;
const jwt = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{10,}\b/;

export function pathViolations(path) {
  path = path.replaceAll('\\', '/');
  const findings = [];
  if (/(?:^|\/)(?:__pycache__|node_modules|\.venv|venv|\.pytest_cache|\.cache|\.tmp|\.local-archive|\.secrets|\.ci-tls|dist|build|htmlcov|coverage|test-results(?:-[^/]+)?|playwright-report|blob-report|backups)(?:\/|$)/.test(path)) {
    findings.push('generated or private directory');
  }
  if (/\.(?:py[co]|dump(?:\.sha256)?|sql\.(?:gz|zst)|sqlite(?:3)?(?:-wal|-shm|-journal)?|log|har|tsbuildinfo|code-workspace|pfx|p12|key)$/.test(path)) {
    findings.push('generated, local or sensitive file');
  }
  if (/(?:^|\/)\.env(?:$|\.)/.test(path) && !/(?:^|\/)\.env(?:\.production)?\.example$/.test(path)) {
    findings.push('private environment file tracked');
  }
  if (/^tests_perf\/reports\/.*\.html$/.test(path)) findings.push('generated benchmark HTML');
  if (/^tests_perf\/reports\/.*-local\.json$/.test(path)) findings.push('local benchmark output');
  if (path === 'package-lock.json' && !existsSync(resolve(root, 'package.json'))) findings.push('root lockfile without manifest');
  return findings;
}

export function violations(path, content) {
  path = path.replaceAll('\\', '/');
  const findings = pathViolations(path);
  if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(content)) findings.push('private key');
  if (/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/.test(content)) findings.push('credential signature');
  if (jwt.test(content)) findings.push('serialized JWT; generate test tokens at runtime, never commit them');
  if (/\.env.*(?:example|template)$/.test(path)) {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || !sensitive.test(match[1])) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      if (!placeholder.test(value)) findings.push(`non-placeholder ${match[1]}`);
    }
  }
  return findings;
}

export function checkRepository() {
  // git ls-files reflects the index: intentionally untracked local copies are excluded.
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  let failed = false;
  for (const path of files) {
    const pathFindings = pathViolations(path);
    let findings = pathFindings;
    const absolute = resolve(root, path);
    if (!pathFindings.length && existsSync(absolute)) {
      // Reject backups/generated paths before reading large or sensitive binary files.
      const content = readFileSync(absolute, 'utf8');
      if (!content.includes('\0')) findings = violations(path, content);
    }
    for (const reason of findings) {
      console.error(`${path}: ${reason}`); // Never echo matched content or credentials.
      failed = true;
    }
  }
  return !failed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    assert.equal(violations('.env.production.example', 'EMAIL_HOST_PASSWORD=change-me-in-private-env').length, 0);
    assert.equal(violations('.env.production.example', 'EMAIL_HOST_PASSWORD=not-a-placeholder').length, 1);
    assert.ok(pathViolations('backups/example.dump').length);
    assert.ok(pathViolations('test-results/example.png').length);
    console.log('Repository guard self-tests passed.');
  } else {
    const passed = checkRepository();
    process.exitCode = passed ? 0 : 1;
    if (passed) console.log('Versionable-file hygiene and secret guard passed (not a history or database audit).');
  }
}
