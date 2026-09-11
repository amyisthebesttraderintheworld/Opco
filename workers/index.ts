export interface Env {
  TONRPC_ENDPOINT?: string;
  CONTRACT_ADDRESS?: string;
  OPCO_JETTON_MASTER?: string;
  MUSDT_JETTON_MASTER?: string;
  ASSETS: Fetcher;
  ROUND_DB?: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

const DEFAULT_CONTRACT_ADDRESS = 'EQBXKvC_gYJLNGpp4i5X0D__QMHhIa-9183D8HjJoWXKKs-U';

function databaseRequired(env: Env): D1Database {
  if (!env.ROUND_DB) throw new Error('Round tracking database is not configured');
  return env.ROUND_DB;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function syncRoundStatuses(database: D1Database) {
  const now = Math.floor(Date.now() / 1000);
  await database.prepare(`UPDATE rounds SET status = CASE
    WHEN ? < starts_at THEN 'queued'
    WHEN ? < commit_ends_at THEN 'committing'
    WHEN ? < reveal_ends_at THEN 'revealing'
    ELSE 'awaiting-resolution'
  END, updated_at = ?
  WHERE status NOT IN ('resolved', 'claimed')`).bind(now, now, now, now).run();
}

async function listRounds(env: Env) {
  const database = databaseRequired(env);
  await syncRoundStatuses(database);
  const result = await database.prepare('SELECT * FROM rounds ORDER BY starts_at DESC LIMIT 50').all();
  return Response.json({ rounds: result.results });
}

async function createRound(request: Request, env: Env) {
  const database = databaseRequired(env);
  const body = await request.json() as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  const startsAt = Number(body.startsAt ?? now);
  const duration = Number(body.duration ?? 3600);
  const revealDuration = Number(body.revealDuration ?? 600);
  const roundId = Number(body.roundId ?? 1);
  if (!Number.isSafeInteger(startsAt) || !Number.isSafeInteger(duration) || !Number.isSafeInteger(revealDuration) || duration <= 0 || revealDuration <= 0) {
    return jsonError('startsAt, duration, and revealDuration must be positive integer seconds', 400);
  }

  const id = crypto.randomUUID();
  const contractAddress = String(body.contractAddress ?? env.CONTRACT_ADDRESS ?? DEFAULT_CONTRACT_ADDRESS);
  const commitEndsAt = startsAt + duration;
  const revealEndsAt = commitEndsAt + revealDuration;
  await database.prepare(`INSERT INTO rounds
    (id, contract_address, round_id, stake_type, starts_at, commit_ends_at, reveal_ends_at, status, created_at, updated_at)
    VALUES (?, ?, ?, 'free', ?, ?, ?, ?, ?, ?)`)
    .bind(id, contractAddress, roundId, startsAt, commitEndsAt, revealEndsAt, startsAt > now ? 'queued' : 'committing', now, now)
    .run();
  return Response.json({ id, contractAddress, roundId, stakeType: 'free', startsAt, commitEndsAt, revealEndsAt }, { status: 201 });
}

async function getRound(env: Env, id: string) {
  const database = databaseRequired(env);
  await syncRoundStatuses(database);
  const round = await database.prepare('SELECT * FROM rounds WHERE id = ?').bind(id).first();
  if (!round) return jsonError('Round not found', 404);
  return Response.json({ round });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'open-cooperation-experiment', contract: env.CONTRACT_ADDRESS ?? 'EQBXKvC_gYJLNGpp4i5X0D__QMHhIa-9183D8HjJoWXKKs-U' });
    }

    if (url.pathname === '/api/config') {
      return Response.json({
        contractAddress: env.CONTRACT_ADDRESS ?? 'EQBXKvC_gYJLNGpp4i5X0D__QMHhIa-9183D8HjJoWXKKs-U',
        network: 'testnet',
        rpc: env.TONRPC_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC',
        deployedAt: '2026-09-11T00:00:00Z',
        assets: {
          opco: env.OPCO_JETTON_MASTER ?? null,
          mUsdt: env.MUSDT_JETTON_MASTER ?? null,
        },
      });
    }

    if (url.pathname === '/api/rounds') {
      try {
        return request.method === 'POST' ? await createRound(request, env) : await listRounds(env);
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : 'Round tracking unavailable', 503);
      }
    }

    const roundMatch = url.pathname.match(/^\/api\/rounds\/([^/]+)$/);
    if (roundMatch && request.method === 'GET') {
      try {
        return await getRound(env, roundMatch[1]);
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : 'Round tracking unavailable', 503);
      }
    }

    if (url.pathname.startsWith('/api/round')) {
      const contractAddress = env.CONTRACT_ADDRESS ?? DEFAULT_CONTRACT_ADDRESS;
      const rpc = env.TONRPC_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
      return Response.json({
        contractAddress,
        network: 'testnet',
        rpc,
        status: 'ready',
      });
    }

    return env.ASSETS.fetch(request);
  },
};
