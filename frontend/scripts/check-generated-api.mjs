import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'sentinel-contract-'));
const output = join(directory, 'api.ts');
try {
  execFileSync(process.execPath, ['node_modules/openapi-typescript/bin/cli.js', '../docs/reference-api.json', '-o', output], { stdio: 'pipe' });
  const normalize = file => readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  if (normalize(output) !== normalize('src/types/generated/api.ts')) throw new Error('Regenera los tipos con npm run generate:api.');
  console.log('OpenAPI types are reproducible and current.');
} finally {
  unlinkSync(output);
  rmdirSync(directory);
}
