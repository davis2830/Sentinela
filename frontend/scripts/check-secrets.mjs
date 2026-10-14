import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sensitive = /(?:PASSWORD|SECRET_KEY|(?:^|_)TOKEN$|API_KEY|EMAIL_HOST_USER)/i;
const placeholder = /^(?:|change-me[^\s]*|replace[-_].*|your[-_].*|example[^\s]*|<[^>]+>|\$\{[^}]+\})$/i;
export function violations(path, content) {
  const findings = [];
  if (/(?:^|\/)\.env(?:\.production)?$/.test(path)) findings.push('private environment file tracked');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) findings.push('private key');
  if (/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/.test(content)) findings.push('credential signature');
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

if (process.argv.includes('--self-test')) {
  assert.equal(violations('.env.production.example', 'EMAIL_HOST_PASSWORD=change-me-in-private-env').length, 0);
  assert.equal(violations('.env.production.example', 'EMAIL_HOST_PASSWORD=not-a-placeholder').length, 1);
  assert.equal(violations('.env', 'DEBUG=True').length, 1);
  console.log('Secret guard self-tests passed.');
} else {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  let failed = false;
  for (const path of files) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, 'utf8');
    if (content.includes('\0')) continue;
    for (const reason of violations(path, content)) {
      // Only file and category; never echo any matched value.
      console.error(`${path}: ${reason}`);
      failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
  if (!failed) console.log('Versionable-file secret guard passed (not a history audit).');
}
