DO $$
BEGIN
  ALTER TABLE public.chores REPLICA IDENTITY FULL;
  ALTER TABLE public.chore_categories REPLICA IDENTITY FULL;
  ALTER TABLE public.chore_completions REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chores') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chores';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chore_categories') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chore_categories';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chore_completions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chore_completions';
  END IF;
END $$;