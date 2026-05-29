-- Borradores de ronda en curso (sincronizan entre dispositivos/sesiones).
CREATE TABLE IF NOT EXISTS round_monitoring_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  round_local_id text NOT NULL,
  round_codigo text,
  modulo_label text,
  payload jsonb NOT NULL,
  participant_user_ids uuid[] NOT NULL DEFAULT '{}',
  efectivas_count int NOT NULL DEFAULT 0,
  total_casas int NOT NULL DEFAULT 20,
  fase text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, round_local_id)
);

CREATE INDEX IF NOT EXISTS round_drafts_participant_idx
  ON round_monitoring_drafts USING gin (participant_user_ids);

CREATE INDEX IF NOT EXISTS round_drafts_active_idx
  ON round_monitoring_drafts (is_active, updated_at DESC);
