CREATE TABLE "user_refresh_session" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_refresh_session_pkey" PRIMARY KEY ("session_id")
);
CREATE UNIQUE INDEX "user_refresh_session_token_hash_key" ON "user_refresh_session"("token_hash");
CREATE INDEX "user_refresh_session_user_id_revoked_at_idx" ON "user_refresh_session"("user_id", "revoked_at");
CREATE INDEX "user_refresh_session_expires_at_idx" ON "user_refresh_session"("expires_at");
ALTER TABLE "user_refresh_session" ADD CONSTRAINT "user_refresh_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
