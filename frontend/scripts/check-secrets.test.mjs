import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathViolations, violations } from './check-secrets.mjs';
import { safeSummaryJSON } from '../../tests_perf/helpers/reporters.js';

const repositoryFile = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const templateKeys = content => new Set([...content.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]));

test('environment templates cover settings and Compose inputs without duplicate keys', () => {
  const local = repositoryFile('.env.example');
  const documented = templateKeys(local);
  for (const path of ['backend/config/settings/base.py', 'backend/config/settings/dev.py',
    'backend/config/settings/prod.py', 'backend/common/crypto.py']) {
    const inputs = [...repositoryFile(path).matchAll(/os\.(?:environ\.get|getenv)\(\s*["']([A-Z][A-Z0-9_]*)["']/g)];
    for (const [, key] of inputs) assert.ok(documented.has(key), `${path}: missing ${key}`);
  }
  for (const [template, compose] of [['.env.example', 'docker-compose.yml'],
    ['.env.production.example', 'docker-compose.prod.yml']]) {
    const content = repositoryFile(template);
    const active = [...content.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]);
    assert.equal(active.length, new Set(active).size, `${template}: duplicate keys`);
    const keys = templateKeys(content);
    for (const [, key] of repositoryFile(compose).matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)) {
      assert.ok(keys.has(key), `${template}: missing Compose input ${key}`);
    }
    assert.match(content, /^RETENTION_PLAN_CAP_ENFORCED=false$/m);
    assert.match(content, /^ENFORCE_LEGACY_EMAIL_VERIFICATION=false$/m);
  }
  assert.match(local, /^JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15$/m);
  assert.match(local, /^PUBLIC_APP_URL=http:\/\/localhost:3001$/m);
});

test('reject generated and private files at root and in frontend', () => {
  for (const path of ['backups/database.dump', 'database.dump.sha256', 'frontend/test-results/view.png',
    'test-results/view.png', 'frontend/test-results-audit/trace.zip', 'frontend/playwright-report/index.html',
    'backend/__pycache__/models.pyc', 'frontend/node_modules/package/index.js', 'frontend/dist/index.html',
    'frontend/coverage/index.html', 'frontend/build.tsbuildinfo', 'local.code-workspace',
    '.local-archive/prototype.html', 'database.sqlite3-wal', 'session.har', 'private.key',
    'tests_perf/reports/summary.html', 'tests_perf/reports/beta-read-baseline-local.json',
    'frontend\\test-results\\view.png']) {
    assert.ok(pathViolations(path).length, path);
  }
});

test('keep source, real assets, migrations, fixtures and historical sanitized evidence', () => {
  for (const path of ['frontend/index.html', 'frontend/package-lock.json', 'frontend/src/App.tsx',
    'frontend/e2e/fixtures/probe-telemetry.html', 'frontend/public/logo.png', 'frontend/public/logo.webp',
    'frontend/public/globe.jpg', 'frontend/public/globe.webp', 'backend/monitoring/migrations/0008_agent_probe_telemetry.py',
    'backend/monitoring/tests_agent_delivery.py', 'scripts/backup_db.sh', '.env.example', '.env.production.example',
    '.dockerignore', 'backend/.dockerignore', 'frontend/.dockerignore', 'sentinine/release/RELEASE_NOTES.md',
    'tests_perf/reports/beta-read-baseline-20261007.json']) {
    assert.deepEqual(pathViolations(path), [], path);
  }
});

test('only public environment templates are allowed', () => {
  for (const path of ['.env', '.env.production', '.env.local', 'frontend/.env.local']) {
    assert.ok(pathViolations(path).length, path);
  }
  assert.deepEqual(violations('.env.example', 'EMAIL_HOST_PASSWORD=change-me-in-private-env'), []);
  assert.ok(violations('.env.example', 'EMAIL_HOST_PASSWORD=not-a-placeholder').length);
});

test('reject serialized JWTs without storing an actual credential in this test', () => {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [part({alg:'HS256',typ:'JWT'}), part({sub:'isolated-test',exp:1}), 'not-a-real-signature'].join('.');
  const findings = violations('tests_perf/reports/fixture.json', JSON.stringify({setup_data:{token}}));
  assert.ok(findings.some(value => value.includes('JWT')));
  assert.ok(findings.every(value => !value.includes(token)));
});

test('sanitized performance evidence is accepted', () => {
  assert.deepEqual(violations('tests_perf/reports/fixture.json', JSON.stringify({setup_data:null,metrics:{checks:529}})), []);
});

test('authenticated benchmark export strips setup credentials without changing metrics', () => {
  const metrics = {http_reqs:{values:{count:529}},http_req_duration:{values:{'p(95)':28.79}}};
  const data = {metrics,root_group:{checks:[]},setup_data:{token:'isolated-sensitive-fixture'}};
  const serialized = safeSummaryJSON(data);
  assert.deepEqual(JSON.parse(serialized), {metrics,root_group:{checks:[]},setup_data:null});
  assert.equal(serialized.includes('isolated-sensitive-fixture'), false);
  assert.equal(data.setup_data.token, 'isolated-sensitive-fixture');
});
