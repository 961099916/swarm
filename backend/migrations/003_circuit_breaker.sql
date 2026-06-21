-- Migration: 003_circuit_breaker.sql
-- Create circuit_breakers table for concurrent-safe distributed circuit breaking

CREATE TABLE IF NOT EXISTS circuit_breakers (
  service_name           TEXT PRIMARY KEY,
  state                  TEXT NOT NULL DEFAULT 'CLOSED' CHECK(state IN ('CLOSED', 'HALF_OPEN', 'OPEN')),
  failure_count          INTEGER NOT NULL DEFAULT 0,
  last_failure_time      INTEGER NOT NULL DEFAULT 0,
  last_state_change_time INTEGER NOT NULL DEFAULT 0,
  half_open_attempts     INTEGER NOT NULL DEFAULT 0
);
