-- Additive role only. Apply separately before deploying DEV-enabled code.
-- No users are reassigned; project access remains shared for approved users.
-- PostgreSQL requires COMMIT before using a newly added enum value.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid='public.users'::regclass AND attname='role'
        AND atttypid='public.user_role'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Expected users.role to use public.user_role';
  END IF;
  IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
        FROM pg_enum WHERE enumtypid='public.user_role'::regtype)
      NOT IN (ARRAY['USER','LEADER','ADMIN'],ARRAY['USER','LEADER','ADMIN','DEV']) THEN
    RAISE EXCEPTION 'Unexpected existing role enum values';
  END IF;
END $$;
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DEV';
COMMIT;
