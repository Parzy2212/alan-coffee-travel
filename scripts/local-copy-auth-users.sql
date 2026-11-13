-- Run on a LOCAL restore copy only (Docker pgf), never on Supabase.
-- A restore with an empty auth.users silently drops the foreign keys to it
-- (shop_users, account_events), so tests pass locally and fail on the real
-- database. This gives the copy the real auth.users structure (from the
-- 2026-11-13 backup, no logins / emails / passwords), placeholder rows with
-- only the ids the shop tables already use, and all 6 foreign keys as live.
-- docker exec -i pgf psql -U postgres -d <copy> -v ON_ERROR_STOP=1 < scripts/local-copy-auth-users.sql
BEGIN;
DROP TABLE IF EXISTS auth.users CASCADE;
CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);
ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);
ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);
CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);
CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));
CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);
CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);
-- placeholder rows: only the user ids the shop tables already reference
CREATE TEMP TABLE t_ids AS
  SELECT user_id::uuid AS id FROM public.account_events WHERE user_id IS NOT NULL
  UNION SELECT user_id::uuid AS id FROM public.guides WHERE user_id IS NOT NULL
  UNION SELECT user_id::uuid AS id FROM public.notification_preferences WHERE user_id IS NOT NULL
  UNION SELECT invited_by_user_id::uuid AS id FROM public.shop_invitations WHERE invited_by_user_id IS NOT NULL
  UNION SELECT user_id::uuid AS id FROM public.shop_users WHERE user_id IS NOT NULL
  UNION SELECT user_id::uuid AS id FROM public.user_preferences WHERE user_id IS NOT NULL;
INSERT INTO auth.users (id, aud, role) SELECT id, 'authenticated', 'authenticated' FROM t_ids;
ALTER TABLE ONLY public.account_events
    ADD CONSTRAINT account_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shop_invitations
    ADD CONSTRAINT shop_invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shop_users
    ADD CONSTRAINT shop_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
GRANT SELECT ON auth.users TO postgres;
COMMIT;
