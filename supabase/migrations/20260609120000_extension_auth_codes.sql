-- One-time codes for Chrome extension MeetFlow login handshake.
CREATE TABLE IF NOT EXISTS extension_auth_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  session_expires_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS extension_auth_codes_expires_at_idx ON extension_auth_codes (expires_at);

ALTER TABLE extension_auth_codes ENABLE ROW LEVEL SECURITY;
