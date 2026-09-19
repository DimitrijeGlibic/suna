import { createDb, type Database } from '@kortix/db';
import { config } from '../config';
import { contextualDatabase } from './db-context';
import { traceDb } from './query-trace';

const globalForDb = globalThis as typeof globalThis & {
  __kortixApiDb?: Database;
  __kortixApiDbUrl?: string;
};

/**
 * Database availability flag.
 * Check this before importing any DB-dependent modules.
 */
export const hasDatabase: boolean = !!config.DATABASE_URL;

/**
 * Database connection.
 *
 * In local mode without DATABASE_URL, this throws on first use.
 * All DB-dependent routes are only loaded when DATABASE_URL is set
 * (see index.ts conditional imports), so this is safe.
 *
 * Typed as non-null Database to avoid null-check noise in every consumer.
 * The runtime guard catches misconfiguration if it ever happens.
 */
function getDb(): Database {
  if (!config.DATABASE_URL) {
    return new Proxy({} as Database, {
      get(_, prop) {
        throw new Error(
          `DATABASE_URL is not configured. Cannot access db.${String(prop)}. ` +
          `This route requires a database connection.`,
        );
      },
    }) as Database;
  }

  if (globalForDb.__kortixApiDb && globalForDb.__kortixApiDbUrl === config.DATABASE_URL) {
    return globalForDb.__kortixApiDb;
  }

  globalForDb.__kortixApiDb = createDb(config.DATABASE_URL);
  globalForDb.__kortixApiDbUrl = config.DATABASE_URL;
  return globalForDb.__kortixApiDb;
}

// TEMP (prompt-delivery-latency research): traceDb is a pass-through unless KORTIX_QUERY_TRACE=1.
export const { db, transaction: withDbTransaction, afterCommit: afterDbCommit } = contextualDatabase(traceDb(getDb()));
