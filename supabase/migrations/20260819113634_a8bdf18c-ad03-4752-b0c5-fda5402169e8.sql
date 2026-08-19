CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.cloud_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'demo' CHECK (mode IN ('demo','real')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
GRANT SELECT, INSERT, UPDATE ON public.cloud_settings TO authenticated;
GRANT ALL ON public.cloud_settings TO service_role;
ALTER TABLE public.cloud_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloud_settings_read" ON public.cloud_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cloud_settings_admin_insert" ON public.cloud_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "cloud_settings_admin_update" ON public.cloud_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.cloud_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('aws','azure','gcp','kubernetes')),
  display_name text NOT NULL,
  region text NOT NULL,
  account_ref text,
  auth_method text NOT NULL DEFAULT 'role',
  credential_ref text,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','disabled')),
  last_checked_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_connections TO authenticated;
GRANT ALL ON public.cloud_connections TO service_role;
ALTER TABLE public.cloud_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloud_connections_read" ON public.cloud_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "cloud_connections_admin_write" ON public.cloud_connections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER cloud_connections_updated_at BEFORE UPDATE ON public.cloud_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.cloud_settings (organization_id, mode)
SELECT id, 'demo' FROM public.organizations ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;