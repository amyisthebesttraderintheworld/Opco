const { spawnSync } = require('node:child_process');
const { readFileSync, existsSync, statSync, chmodSync } = require('node:fs');
const { resolve } = require('node:path');

const envPath = resolve(process.cwd(), '.env');
const env = { ...process.env };

if (existsSync(envPath)) {
  const mode = statSync(envPath).mode & 0o777;
  if ((mode & 0o077) !== 0) chmodSync(envPath, 0o600);

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!Object.prototype.hasOwnProperty.call(env, key)) {
      env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('No command provided');
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 1);
