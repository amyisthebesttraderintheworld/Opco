const { chmodSync, readFileSync, statSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const envPath = resolve(process.cwd(), '.env');
const environment = { ...process.env };

try {
  const mode = statSync(envPath).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    chmodSync(envPath, 0o600);
    process.stderr.write('Adjusted .env permissions to owner-only (0600).\n');
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in environment) continue;
    environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const token = environment.CLOUDFLARE_API_TOKEN || environment.CLOUDFLARE_API_KEY;
if (!token) {
  process.stderr.write('Missing CLOUDFLARE_API_TOKEN in .env.\n');
  process.exit(1);
}

environment.CLOUDFLARE_API_TOKEN = token;
delete environment.CLOUDFLARE_API_KEY;

const wranglerArgs = process.argv.slice(2);
if (wranglerArgs[0] === 'pages' && wranglerArgs[1] === 'deploy' && !wranglerArgs.includes('--project-name')) {
  wranglerArgs.push('--project-name', environment.CLOUDFLARE_PROJECT_NAME || 'open-cooperation-experiment');
}

const result = spawnSync('npx', ['wrangler', ...wranglerArgs], {
  env: environment,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);