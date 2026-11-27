-- Runs once when the coder-postgres volume is first created (compose.factory.yaml mounts
-- dev/coder-postgres-init at /docker-entrypoint-initdb.d). Isolates adam-coder-fast and
-- adam-coder-light run queues into separate databases (E3-T1, ADR 0073).
CREATE DATABASE coder_fast;
CREATE DATABASE coder_light;
