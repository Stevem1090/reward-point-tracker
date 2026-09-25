REVOKE EXECUTE ON FUNCTION public.current_family_id(), public.is_family_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_family_id(), public.is_family_master(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_invite_info(text) FROM anon;