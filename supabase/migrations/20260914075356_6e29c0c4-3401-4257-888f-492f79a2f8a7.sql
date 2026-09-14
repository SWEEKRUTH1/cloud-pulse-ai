REVOKE ALL ON FUNCTION public.audit_scaling_event() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_resource_bounds() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_policy_bounds() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;