"""Cache for web-search results.

Why: Tavily's free tier is 1,000 credits a month, and evaluations must be
reproducible (every run should see exactly the same sources).

Backends, picked from the environment:
  SEARCH_CACHE_FILE=path.jsonl  → a local JSON-lines file (frozen snapshots for evals)
  DATABASE_URL=postgres://…     → the shared "SearchCache" table in Postgres
  (neither)                     → in-process memory (lost on restart)

SEARCH_CACHE_TTL_HOURS (default 168 = 7 days) controls how long live results are
reused; 0 means "never expire" (use for evals).
"""
import asyncio
import hashlib
import json
import logging
import os
import threading
import time
from collections import OrderedDict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

logger = logging.getLogger(__name__)


def cache_key(query: str, params: dict) -> str:
    normal = " ".join(query.lower().split())
    raw = json.dumps({"q": normal, **params}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _ttl_seconds() -> float:
    hours = float(os.getenv("SEARCH_CACHE_TTL_HOURS", "168"))
    return float("inf") if hours <= 0 else hours * 3600


class MemoryBackend:
    name = "memory"

    def __init__(self, size: int = 500):
        self._data: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self._size = size
        self._lock = threading.Lock()

    def get(self, key, max_age):
        with self._lock:
            hit = self._data.get(key)
            if hit and time.time() - hit[0] <= max_age:
                self._data.move_to_end(key)
                return hit[1]
        return None

    def put(self, key, query, params, results):
        with self._lock:
            self._data[key] = (time.time(), results)
            self._data.move_to_end(key)
            while len(self._data) > self._size:
                self._data.popitem(last=False)


class FileBackend(MemoryBackend):
    """JSON-lines file: one {"key","query","params","results","ts"} per line."""
    name = "file"

    def __init__(self, path: str):
        super().__init__(size=10**9)
        self._path = path
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if line.strip():
                        row = json.loads(line)
                        self._data[row["key"]] = (row.get("ts", 0), row["results"])

    def get(self, key, max_age):
        # Frozen snapshots never expire.
        with self._lock:
            hit = self._data.get(key)
            return hit[1] if hit else None

    def put(self, key, query, params, results):
        super().put(key, query, params, results)
        with self._lock, open(self._path, "a") as f:
            f.write(json.dumps({"key": key, "query": query, "params": params,
                                "results": results, "ts": time.time()}) + "\n")


class PostgresBackend:
    name = "postgres"

    # Prisma-only URL options that libpq/psycopg reject.
    _DROP = {"pgbouncer", "connection_limit", "pool_timeout", "schema", "statement_cache_size"}

    def __init__(self, url: str):
        import psycopg  # imported lazily so the dependency is optional
        self._psycopg = psycopg
        parts = urlsplit(url)
        query = [(k, v) for k, v in parse_qsl(parts.query) if k not in self._DROP]
        self._url = urlunsplit(parts._replace(query=urlencode(query)))

    def _connect(self):
        return self._psycopg.connect(self._url, connect_timeout=5, autocommit=True)

    def get(self, key, max_age):
        with self._connect() as conn:
            row = conn.execute(
                'SELECT "results", EXTRACT(EPOCH FROM (NOW() - "createdAt")) FROM "SearchCache" WHERE "key" = %s',
                (key,),
            ).fetchone()
        if row and float(row[1]) <= max_age:
            return row[0]
        return None

    def put(self, key, query, params, results):
        from psycopg.types.json import Jsonb
        with self._connect() as conn:
            conn.execute(
                'INSERT INTO "SearchCache" ("key","query","params","results","createdAt") '
                "VALUES (%s,%s,%s,%s,NOW()) "
                'ON CONFLICT ("key") DO UPDATE SET "results" = EXCLUDED."results", "createdAt" = NOW()',
                (key, query, Jsonb(params), Jsonb(results)),
            )


def _make_backend():
    if os.getenv("SEARCH_CACHE_FILE"):
        return FileBackend(os.environ["SEARCH_CACHE_FILE"])
    if os.getenv("DATABASE_URL"):
        try:
            return PostgresBackend(os.environ["DATABASE_URL"])
        except ImportError:
            logger.warning("psycopg not installed; search cache falls back to memory")
    return MemoryBackend()


_backend = None
stats = {"hits": 0, "misses": 0, "errors": 0}


def backend():
    global _backend
    if _backend is None:
        _backend = _make_backend()
    return _backend


async def cached_search(search, query: str, params: dict):
    """Returns cached results for (query, params), else calls `search(query)` and stores the result.

    Cache failures never break a search: they're logged and the live call is used.
    """
    key = cache_key(query, params)
    b = backend()
    try:
        hit = await asyncio.to_thread(b.get, key, _ttl_seconds())
        if hit is not None:
            stats["hits"] += 1
            return hit
    except Exception as e:  # noqa: BLE001 — cache must never break research
        stats["errors"] += 1
        logger.warning(f"Search cache read failed ({b.name}): {e}")

    stats["misses"] += 1
    results = await search(query)
    try:
        await asyncio.to_thread(b.put, key, query, params, results)
    except Exception as e:  # noqa: BLE001
        stats["errors"] += 1
        logger.warning(f"Search cache write failed ({b.name}): {e}")
    return results
