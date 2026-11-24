CREATE TABLE IF NOT EXISTS orbit_records (
    key text PRIMARY KEY,
    content jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orbit_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    reference text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
