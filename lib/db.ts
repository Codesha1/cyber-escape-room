import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __cerPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __cerSchema: Promise<void> | undefined;
}

function makePool(): Pool {
  const raw = (process.env.DATABASE_URL || '').trim();
  if (!raw) throw new Error('DATABASE_URL غير مضبوط');
  // إزالة sslmode من الرابط: نضبط التشفير بأنفسنا ليعمل مع Supabase دون أخطاء الشهادة
  const url = raw.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');
  const local = /@(localhost|127\.0\.0\.1)(:|\/)|host=\/|^postgres(ql)?:\/\/\/?[^@]*$/.test(url);
  return new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? false : { rejectUnauthorized: false },
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_open boolean NOT NULL DEFAULT true,
  play_open boolean NOT NULL DEFAULT true,
  results_announced boolean NOT NULL DEFAULT false,
  announced_at timestamptz
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS participants (
  id serial PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  recovery_code text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  step int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  wrong_attempts int NOT NULL DEFAULT 0,
  active_ms bigint NOT NULL DEFAULT 0,
  last_beat timestamptz,
  adjustment int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  id bigserial PRIMARY KEY,
  participant_id int NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  choice text NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_participant_idx ON attempts (participant_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  participant_id int,
  participant_name text,
  details text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

function pool(): Pool {
  if (!globalThis.__cerPool) globalThis.__cerPool = makePool();
  return globalThis.__cerPool;
}

async function ensureSchema(): Promise<void> {
  if (!globalThis.__cerSchema) {
    globalThis.__cerSchema = (async () => {
      const c = await pool().connect();
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(724501)');
        await c.query(SCHEMA);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        globalThis.__cerSchema = undefined;
        throw e;
      } finally {
        c.release();
      }
    })();
  }
  return globalThis.__cerSchema;
}

export async function q<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const r = await pool().query<T>(text, params as any[]);
  return r.rows;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool().connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
