import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  realpathSync, renameSync, rmdirSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Synthetic-only Windows gate. No credentials, production connection or target option.
const workspace = 'C:\\Work\\SideProject\\ApplyTrack';
assert.equal(process.platform, 'win32', 'Windows-only synthetic test.');
assert.equal(realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')), workspace);
const base = path.join(workspace, 'tmp', 'rf04-stage4.local');
const scratch = path.join(base, 'scratch');
const tools = path.join(base, 'tools', 'age-v1.3.2');
for (const directory of [workspace, path.join(workspace, 'tmp'), base, scratch, path.join(base, 'tools'), tools]) {
  assert.ok(!lstatSync(directory).isSymbolicLink() && realpathSync(directory) === directory, 'Unexpected path boundary.');
}
const binaries = {
  'age.exe': '2821a4ed191da07372acd302e5f6feae7a7985e285e1417765ebe74025af45f0',
  'age-keygen.exe': '1549c7049be32695594bedd09bbd352a94b6013a9d5c43364f3c6cd7a09ab61c',
};
for (const [name, expected] of Object.entries(binaries)) {
  const file = path.join(tools, name);
  assert.ok(!lstatSync(file).isSymbolicLink(), 'Unexpected executable boundary.');
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, 'Verified package binary changed.');
}

const runDirectory = path.join(scratch, `age-synthetic-${randomUUID()}`);
mkdirSync(runDirectory);
const checks = [];
const identities = [];
const files = new Set();
const file = name => {
  files.add(name);
  return path.join(runDirectory, name);
};
const check = (condition, label) => {
  assert.ok(condition, label);
  checks.push(label);
};
const run = (binary, args, input) => {
  const result = spawnSync(path.join(tools, binary), args, {
    input, windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    cwd: runDirectory,
    env: { ...process.env, TEMP: scratch, TMP: scratch },
  });
  // Never include subprocess output in errors: keygen stdout contains private identity.
  check(!result.error && Number.isInteger(result.status), 'native process exited normally');
  return result;
};
const identity = () => {
  const generated = run('age-keygen.exe', []);
  identities.push(generated.stdout);
  check(generated.status === 0, 'temporary native identity generation succeeded');
  const publicResult = run('age-keygen.exe', ['-y'], generated.stdout);
  check(publicResult.status === 0, 'public recipient derivation succeeded');
  const recipient = publicResult.stdout.toString('utf8').trim();
  check(/^age1[0-9a-z]+$/.test(recipient), 'native recipient format');
  publicResult.stdout.fill(0);
  generated.stderr.fill(0);
  return { privateBytes: generated.stdout, recipient };
};
const decrypt = (ciphertext, privateBytes, outputName) => {
  const output = file(outputName);
  const staging = file(`${outputName}.partial`);
  check(!existsSync(output) && !existsSync(staging), 'output paths are initially absent');
  let committed = false;
  try {
    const result = run('age.exe', ['--decrypt', '--identity', '-', '--output', staging, ciphertext], privateBytes);
    const partialObserved = existsSync(staging) && lstatSync(staging).size > 0;
    if (result.status === 0) {
      renameSync(staging, output);
      committed = true;
    }
    return { status: result.status, output, partialObserved };
  } finally {
    if (!committed && existsSync(staging)) {
      check(lstatSync(staging).isFile() && !lstatSync(staging).isSymbolicLink(), 'partial output cleanup boundary');
      rmSync(staging);
    }
    check(!existsSync(staging), 'staging output removed or atomically committed');
  }
};

let tamperPartialObserved;
let wrongKeyExit;
let tamperExit;
try {
  const version = run('age.exe', ['--version']);
  check(version.status === 0 && version.stdout.toString('utf8').trim() === 'v1.3.2', 'verified pinned age version');
  const primary = identity();
  const recovery = identity();
  const wrong = identity();
  const recoveryCopy = Buffer.from(recovery.privateBytes);
  identities.push(recoveryCopy);
  recovery.privateBytes.fill(0);
  check(recovery.privateBytes.every(byte => byte === 0), 'original recovery identity buffer cleared before copy-only recovery');

  const plaintext = Buffer.alloc(1024 * 1024 + 37);
  for (let i = 0; i < plaintext.length; i++) plaintext[i] = i % 256;
  const source = file('fabricated.bin');
  const ciphertext = file('fabricated.bin.age');
  writeFileSync(source, plaintext, { flag: 'wx' });
  const encrypted = run('age.exe', ['--recipient', primary.recipient, '--recipient', recovery.recipient, '--output', ciphertext, source]);
  check(encrypted.status === 0, 'two-recipient native age encryption succeeded');
  const normal = decrypt(ciphertext, primary.privateBytes, 'roundtrip.bin');
  check(normal.status === 0 && readFileSync(normal.output).equals(plaintext), 'byte-for-byte binary primary roundtrip');
  const restored = decrypt(ciphertext, recoveryCopy, 'recovered.bin');
  check(restored.status === 0 && readFileSync(restored.output).equals(plaintext), 'separate recovery recipient copy restores identical bytes');
  const denied = decrypt(ciphertext, wrong.privateBytes, 'wrong-key.bin');
  wrongKeyExit = denied.status;
  check(denied.status !== 0 && !existsSync(denied.output), 'wrong native identity rejected with no published output');
  const tampered = file('tampered.age');
  const modified = readFileSync(ciphertext);
  modified[modified.length - 10] ^= 1;
  writeFileSync(tampered, modified, { flag: 'wx' });
  const rejected = decrypt(tampered, primary.privateBytes, 'tampered.bin');
  tamperExit = rejected.status;
  tamperPartialObserved = rejected.partialObserved;
  check(rejected.status !== 0 && !existsSync(rejected.output), 'late ciphertext tampering rejected with no published output');
  check(tamperPartialObserved, 'late tampering exercised cleanup of actual partial plaintext');
} finally {
  for (const bytes of identities) bytes.fill(0);
  check(identities.every(bytes => bytes.every(byte => byte === 0)), 'all held disposable identity buffers cleared');
  check(realpathSync(runDirectory) === runDirectory && !lstatSync(runDirectory).isSymbolicLink(), 'cleanup remains inside exact fresh synthetic directory');
  check(readdirSync(runDirectory).every(name => files.has(name)), 'no unexpected files before non-recursive cleanup');
  for (const name of files) {
    const target = path.join(runDirectory, name);
    if (existsSync(target)) {
      check(lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink(), 'known synthetic file cleanup boundary');
      rmSync(target);
    }
  }
  check(readdirSync(runDirectory).length === 0, 'synthetic file cleanup completed');
  rmdirSync(runDirectory);
  check(!existsSync(runDirectory), 'fresh synthetic directory removed');
}
const evidence = { result: 'PASS', version: '1.3.2', checks: checks.length, wrongKeyExit, tamperExit, tamperPartialObserved, identitiesPersisted: false, permanentKeyCustody: 'NOT VERIFIED', checksPassed: checks };
writeFileSync(path.join(base, 'age-synthetic-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
