-- Runs once when the postgres volume is first created (compose.yaml mounts dev/postgres-init
-- at /docker-entrypoint-initdb.d). Creates the standalone database for factory-board (ADR 0073).
CREATE DATABASE board;
