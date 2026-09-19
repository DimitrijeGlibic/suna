/**
 * RESEARCH ONLY (prompt-delivery-latency): per-flow database query trace.
 *
 * With KORTIX_QUERY_TRACE=1, every statement postgres.js builds inside a traced
 * flow is recorded with its offset, SQL and the first API call sites on the
 * stack, interleaved with the flow's ProvisionTimeline marks. One
 * `[query-trace] {json}` line per flow is printed when the flow ends.
 * Off (the default) it is a pass-through.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface TraceEntry {
  t: number;
  /** q = statement sent (postgres.js), call = db builder invoked (caller site), mark = timeline mark. */
  kind: 'q' | 'call' | 'mark';
  label: string;
  site?: string;
}

interface Trace {
  name: string;
  id: string;
  t0: number;
  entries: TraceEntry[];
}

const store = new AsyncLocalStorage<Trace>();
export const queryTraceEnabled = process.env.KORTIX_QUERY_TRACE === '1';

function callSite(): string {
  const frames = (new Error().stack ?? '').split('\n').slice(1);
  const api = frames
    .filter((f) => f.includes('/apps/api/src/') && !f.includes('query-trace') && !f.includes('/shared/db.ts'))
    .slice(0, 3)
    .map((f) => {
      const m = f.match(/(?:at\s+(\S+)\s+\()?.*\/apps\/api\/src\/([^):]+):(\d+)/);
      return m ? `${m[1] ?? '?'}@${m[2]}:${m[3]}` : f.trim();
    });
  return api.join(' < ');
}

function record(entry: Omit<TraceEntry, 't'>): void {
  const trace = store.getStore();
  if (!trace) return;
  trace.entries.push({ t: Math.round(performance.now() - trace.t0), ...entry });
}

export function traceMark(label: string): void {
  if (queryTraceEnabled) record({ kind: 'mark', label });
}

export function withQueryTrace<T>(name: string, id: string, fn: () => Promise<T>): Promise<T> {
  if (!queryTraceEnabled) return fn();
  const trace: Trace = { name, id, t0: performance.now(), entries: [] };
  return store.run(trace, async () => {
    try {
      return await fn();
    } finally {
      const totalMs = Math.round(performance.now() - trace.t0);
      console.log(`[query-trace] ${JSON.stringify({ name, id, totalMs, queries: trace.entries.filter((e) => e.kind === 'q').length, entries: trace.entries })}`);
    }
  });
}

if (queryTraceEnabled) {
  (globalThis as { __kortixQueryLogger?: (sql: string) => void }).__kortixQueryLogger = (sql: string) =>
    record({ kind: 'q', label: sql.replace(/\s+/g, ' ').slice(0, 400) });
}

const BUILDERS = new Set(['select', 'selectDistinct', 'insert', 'update', 'delete', 'execute', 'transaction']);

/** Record the CALLER of every db builder (synchronous, so the API frame is on the stack). */
export function traceDb<T extends object>(database: T): T {
  if (!queryTraceEnabled) return database;
  return new Proxy(database, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || !BUILDERS.has(String(prop))) return value;
      return (...args: unknown[]) => {
        record({ kind: 'call', label: String(prop), site: callSite() });
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}
