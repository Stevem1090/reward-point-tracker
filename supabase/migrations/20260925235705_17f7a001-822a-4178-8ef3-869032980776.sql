
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My family',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('master','member')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.families TO authenticated;
GRANT SELECT ON public.family_members TO authenticated;
GRANT SELECT, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.families, public.family_members, public.family_invites TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_family_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.is_family_master(_family uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM family_members WHERE user_id = auth.uid() AND family_id = _family AND role = 'master')
$$;

CREATE POLICY "Members view family" ON public.families FOR SELECT TO authenticated USING (id = public.current_family_id());
CREATE POLICY "Master renames family" ON public.families FOR UPDATE TO authenticated USING (public.is_family_master(id)) WITH CHECK (public.is_family_master(id));
CREATE POLICY "Members view members" ON public.family_members FOR SELECT TO authenticated USING (family_id = public.current_family_id());
CREATE POLICY "Master views invites" ON public.family_invites FOR SELECT TO authenticated USING (public.is_family_master(family_id));
CREATE POLICY "Master cancels invites" ON public.family_invites FOR DELETE TO authenticated USING (public.is_family_master(family_id));

CREATE POLICY "Family members view profiles" ON public.user_profiles FOR SELECT TO authenticated
  USING (id IN (SELECT user_id FROM public.family_members WHERE family_id = public.current_family_id()));

-- Seed Steve's family
INSERT INTO public.families (id, name, owner_id) VALUES ('00000000-0000-4000-8000-00000000f001', 'Moran family', '49debb67-055b-4741-aa5f-6f8d72541197');
INSERT INTO public.family_members (family_id, user_id, role) VALUES
  ('00000000-0000-4000-8000-00000000f001', '49debb67-055b-4741-aa5f-6f8d72541197', 'master'),
  ('00000000-0000-4000-8000-00000000f001', '5134510b-d0bf-4c86-a425-4dbb7c6a29d9', 'member');

-- Scope shared tables
DO $$
DECLARE t text; p record;
  tbls text[] := ARRAY['bills','bill_accounts','bill_types','incomes','financial_advice_runs','reward_categories','point_entries','events','reminders','reminder_owners','meal_plans','meals','recipes','recipe_cards','shopping_lists','meal_ratings','family_preferences','freezer_flags','chore_categories','chores','chore_completions','sw_foods','sw_meals','sw_meal_items','task_sections','tasks'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN family_id uuid REFERENCES public.families(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET family_id = %L', t, '00000000-0000-4000-8000-00000000f001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN family_id SET DEFAULT public.current_family_id(), ALTER COLUMN family_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX ON public.%I (family_id)', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    IF t <> 'tasks' THEN
      EXECUTE format('CREATE POLICY "Family members manage" ON public.%I FOR ALL TO authenticated USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id())', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "View family tasks" ON public.tasks FOR SELECT TO authenticated
  USING (family_id = public.current_family_id() AND (is_private = false OR owner_id = auth.uid()));
CREATE POLICY "Create own tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (family_id = public.current_family_id() AND owner_id = auth.uid());
CREATE POLICY "Edit family tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (family_id = public.current_family_id() AND (is_private = false OR owner_id = auth.uid()))
  WITH CHECK (family_id = public.current_family_id());
CREATE POLICY "Delete family tasks" ON public.tasks FOR DELETE TO authenticated
  USING (family_id = public.current_family_id() AND (is_private = false OR owner_id = auth.uid()));

-- Ensure every signed-in user has a family
CREATE OR REPLACE FUNCTION public.ensure_family()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid; uname text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT family_id INTO fid FROM family_members WHERE user_id = auth.uid();
  IF fid IS NOT NULL THEN RETURN fid; END IF;
  SELECT name INTO uname FROM user_profiles WHERE id = auth.uid();
  INSERT INTO families (name, owner_id) VALUES (COALESCE(uname, 'My') || '''s family', auth.uid()) RETURNING id INTO fid;
  INSERT INTO family_members (family_id, user_id, role) VALUES (fid, auth.uid(), 'master');
  INSERT INTO task_sections (name, sort_order, created_by, family_id) VALUES ('Today',0,auth.uid(),fid),('Soon',1,auth.uid(),fid),('Later',2,auth.uid(),fid);
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.create_family_invite(_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE fid uuid := current_family_id(); tok text;
BEGIN
  IF fid IS NULL OR NOT is_family_master(fid) THEN RAISE EXCEPTION 'Only the family master can invite'; END IF;
  _email := lower(trim(_email));
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF EXISTS (SELECT 1 FROM family_members fm JOIN auth.users u ON u.id = fm.user_id WHERE fm.family_id = fid AND lower(u.email) = _email) THEN
    RAISE EXCEPTION 'That person is already in your family';
  END IF;
  DELETE FROM family_invites WHERE family_id = fid AND email = _email AND accepted_at IS NULL;
  tok := encode(gen_random_bytes(24), 'hex');
  INSERT INTO family_invites (family_id, email, token_hash, invited_by)
  VALUES (fid, _email, encode(digest(tok, 'sha256'), 'hex'), auth.uid());
  RETURN tok;
END $$;

CREATE OR REPLACE FUNCTION public.get_invite_info(_token text)
RETURNS TABLE(family_name text, email text, expired boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT f.name, i.email, (i.expires_at < now() OR i.accepted_at IS NOT NULL)
  FROM family_invites i JOIN families f ON f.id = i.family_id
  WHERE i.token_hash = encode(digest(_token, 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.accept_family_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv family_invites; me_email text; old_fid uuid; old_role text; t text;
  tbls text[] := ARRAY['bills','bill_accounts','bill_types','incomes','financial_advice_runs','reward_categories','point_entries','events','reminders','reminder_owners','meal_plans','meals','recipes','recipe_cards','shopping_lists','meal_ratings','family_preferences','freezer_flags','chore_categories','chores','chore_completions','sw_foods','sw_meals','sw_meal_items','tasks'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM family_invites WHERE token_hash = encode(digest(_token, 'sha256'), 'hex');
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF inv.accepted_at IS NOT NULL OR inv.expires_at < now() THEN RAISE EXCEPTION 'This invite has expired'; END IF;
  SELECT lower(email) INTO me_email FROM auth.users WHERE id = auth.uid();
  IF me_email <> inv.email THEN RAISE EXCEPTION 'This invite was sent to %. Sign in with that email.', inv.email; END IF;

  SELECT family_id, role INTO old_fid, old_role FROM family_members WHERE user_id = auth.uid();
  IF old_fid = inv.family_id THEN
    UPDATE family_invites SET accepted_at = now() WHERE id = inv.id; RETURN old_fid;
  END IF;
  IF old_fid IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM family_members WHERE family_id = old_fid AND user_id <> auth.uid()) THEN
      RAISE EXCEPTION 'Leave your current family before joining another';
    END IF;
    -- bring solo data across
    FOREACH t IN ARRAY tbls LOOP
      EXECUTE format('UPDATE public.%I SET family_id = $1 WHERE family_id = $2', t) USING inv.family_id, old_fid;
    END LOOP;
    DELETE FROM families WHERE id = old_fid;
  END IF;
  INSERT INTO family_members (family_id, user_id, role) VALUES (inv.family_id, auth.uid(), 'member');
  UPDATE family_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.family_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_family_member(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid := current_family_id();
BEGIN
  IF fid IS NULL OR NOT is_family_master(fid) THEN RAISE EXCEPTION 'Only the family master can remove people'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself'; END IF;
  DELETE FROM family_members WHERE family_id = fid AND user_id = _user;
  DELETE FROM reminder_owners WHERE owner_id = _user AND family_id = fid;
END $$;

CREATE OR REPLACE FUNCTION public.leave_family()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid := current_family_id();
BEGIN
  IF fid IS NULL THEN RETURN; END IF;
  IF is_family_master(fid) THEN RAISE EXCEPTION 'The family master cannot leave'; END IF;
  DELETE FROM family_members WHERE user_id = auth.uid();
  DELETE FROM reminder_owners WHERE owner_id = auth.uid() AND family_id = fid;
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_family(), public.create_family_invite(text), public.accept_family_invite(text), public.remove_family_member(uuid), public.leave_family(), public.get_invite_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_family(), public.create_family_invite(text), public.accept_family_invite(text), public.remove_family_member(uuid), public.leave_family(), public.get_invite_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_info(text) TO anon;
