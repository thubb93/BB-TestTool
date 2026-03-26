/**
 * DB Connection Pool Manager
 * - Caches one pool per unique connection config
 * - Auto-closes after IDLE_MS of inactivity
 * - Deduplicates concurrent pool-creation requests
 */

import type { DBDriver } from "@/types";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes

export interface DBConfig {
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPool = any;

interface CacheEntry {
  pool: AnyPool;
  driver: DBDriver;
  timer: ReturnType<typeof setTimeout>;
}

// Module-level singletons — persist across requests within the same process
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

function cacheKey(cfg: DBConfig): string {
  return `${cfg.driver}|${cfg.host}|${cfg.port}|${cfg.database}|${cfg.username}`;
}

async function destroyEntry(key: string): Promise<void> {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  try {
    if (entry.driver === "mysql") await entry.pool.end();
    else if (entry.driver === "postgresql") await entry.pool.end();
    else if (entry.driver === "mssql") await entry.pool.close();
  } catch {
    // ignore errors during cleanup
  }
}

function scheduleDestroy(key: string): ReturnType<typeof setTimeout> {
  const t = setTimeout(() => destroyEntry(key), IDLE_MS);
  // Don't keep the process alive just for this timer
  if (typeof t === "object" && "unref" in t) t.unref();
  return t;
}

async function buildEntry(cfg: DBConfig): Promise<CacheEntry> {
  let pool: AnyPool;

  switch (cfg.driver) {
    case "mysql": {
      const mysql = await import("mysql2/promise");
      pool = mysql.createPool({
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: 5000,
        // Enable SSL for cloud-hosted MySQL (e.g. AWS RDS) which uses caching_sha2_password
        ssl: { rejectUnauthorized: false },
      });
      break;
    }

    case "postgresql": {
      const pg = await import("pg");
      pool = new pg.Pool({
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 60_000,
      });
      // Prevent unhandled rejection on idle connection errors
      pool.on("error", () => {});
      break;
    }

    case "mssql": {
      const mssql = await import("mssql");
      pool = new mssql.ConnectionPool({
        server: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
        options: { trustServerCertificate: true },
        connectionTimeout: 5000,
      });
      await pool.connect();
      break;
    }

    default:
      throw new Error(`Connection pooling not supported for driver: ${cfg.driver}`);
  }

  const key = cacheKey(cfg);
  const entry: CacheEntry = {
    pool,
    driver: cfg.driver,
    timer: scheduleDestroy(key),
  };
  return entry;
}

/**
 * Returns a cached pool for the given config, creating one if needed.
 * Resets the 30-minute idle timer on every call.
 */
export async function getPool(cfg: DBConfig): Promise<AnyPool> {
  const key = cacheKey(cfg);

  // Return cached pool and reset idle timer
  const existing = cache.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    existing.timer = scheduleDestroy(key);
    return existing.pool;
  }

  // Deduplicate concurrent creation
  if (pending.has(key)) {
    const entry = await pending.get(key)!;
    return entry.pool;
  }

  const promise = buildEntry(cfg);
  pending.set(key, promise);

  try {
    const entry = await promise;
    cache.set(key, entry);
    return entry.pool;
  } finally {
    pending.delete(key);
  }
}

/** Exposed for health-check / test purposes — runs a simple ping query */
export async function pingPool(cfg: DBConfig): Promise<{ latency: number }> {
  const start = Date.now();
  const pool = await getPool(cfg);

  switch (cfg.driver) {
    case "mysql":
      await pool.query("SELECT 1");
      break;
    case "postgresql":
      await pool.query("SELECT 1");
      break;
    case "mssql":
      await pool.request().query("SELECT 1 AS ok");
      break;
  }

  return { latency: Date.now() - start };
}

/** Execute one or more SQL statements, returning rows for each */
export async function execQueries(
  cfg: DBConfig,
  queries: string[]
): Promise<unknown[]> {
  const pool = await getPool(cfg);
  const results: unknown[] = [];

  switch (cfg.driver) {
    case "mysql": {
      for (const q of queries) {
        const [rows] = await pool.query(q);
        results.push(rows);
      }
      break;
    }
    case "postgresql": {
      for (const q of queries) {
        const res = await pool.query(q);
        results.push(res.rows);
      }
      break;
    }
    case "mssql": {
      for (const q of queries) {
        const res = await pool.request().query(q);
        results.push(res.recordset);
      }
      break;
    }
    default:
      throw new Error(`Query execution not supported for driver: ${cfg.driver}`);
  }

  return results;
}
