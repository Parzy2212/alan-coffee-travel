-- Read-only: is the one active staff row the POS Terminal account? ONE query, one row, no names.
SELECT
  (SELECT count(*) FROM public.staff WHERE is_active AND id = 'ff000000-0000-0000-0000-000000000001')  AS active_pos_terminal,
  (SELECT count(*) FROM public.staff WHERE is_active AND id <> 'ff000000-0000-0000-0000-000000000001') AS active_other_staff,
  (SELECT string_agg(DISTINCT COALESCE(role, '(none)'), ', ') FROM public.staff WHERE is_active)       AS active_roles;
