import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/utils/networkEndpoint.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(compiled,{exports,URL});

test('editing and saving TCP preserves IPv4, hostnames and bracketed IPv6 ports',()=>{
  for(const endpoint of ['10.0.0.1:5432','db.lan:5432','[fd00::10]:5432','[2001:db8::1]:443']){
    const {host,port}=exports.tcpParts(endpoint);
    assert.equal(exports.tcpEndpoint(host,port),endpoint);
  }
});

test('bare IPv6 address is never split into a hostname and guessed port',()=>{
  const parts=exports.tcpParts('fd00::10');
  assert.equal(parts.host,'fd00::10');assert.equal(parts.port,'80');
  assert.equal(exports.tcpEndpoint(parts.host,parts.port),'[fd00::10]:80');
});

test('switching from an HTTPS URL to TCP keeps its host and service port',()=>{
  for(const [url,expected] of [['https://[fd00::10]:8443/path','[fd00::10]:8443'],['https://db.lan/path','db.lan:443']]){
    const {host,port}=exports.tcpParts(url);
    assert.equal(exports.tcpEndpoint(host,port),expected);
  }
});
