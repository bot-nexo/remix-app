BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Bogota',
  currency char(3) NOT NULL DEFAULT 'COP',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT businesses_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone_e164 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_memberships (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

CREATE INDEX business_memberships_user_idx ON public.business_memberships (user_id, status);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_e164 text NOT NULL,
  whatsapp_opt_in_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, phone_e164),
  UNIQUE (business_id, id)
);

CREATE INDEX customers_business_name_idx ON public.customers (business_id, full_name);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  price_minor_units integer NOT NULL CHECK (price_minor_units >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name),
  UNIQUE (business_id, id)
);

CREATE INDEX services_public_catalog_idx ON public.services (business_id, sort_order) WHERE is_active;

CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE (business_id, day_of_week),
  CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);

CREATE TABLE public.schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, exception_date),
  CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  service_id uuid,
  customer_name_snapshot text NOT NULL,
  service_name_snapshot text NOT NULL,
  price_minor_units integer NOT NULL CHECK (price_minor_units >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show')),
  source text NOT NULL DEFAULT 'portal'
    CHECK (source IN ('portal', 'whatsapp', 'admin', 'import')),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (business_id, customer_id)
    REFERENCES public.customers(business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id)
    REFERENCES public.services(business_id, id) ON DELETE SET NULL (service_id),
  CHECK (ends_at > starts_at),
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id),
  EXCLUDE USING gist (
    business_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'in_service'))
);

CREATE INDEX appointments_business_start_idx ON public.appointments (business_id, starts_at);
CREATE INDEX appointments_business_status_start_idx ON public.appointments (business_id, status, starts_at);

CREATE TABLE public.otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash bytea NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('booking_access', 'appointment_change')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_challenges_lookup_idx ON public.otp_challenges (business_id, phone_e164, expires_at DESC);

CREATE TABLE public.whatsapp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'evolution' CHECK (provider IN ('evolution')),
  instance_name text NOT NULL,
  secret_reference text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  last_health_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_id uuid,
  idempotency_key text NOT NULL,
  recipient_e164 text NOT NULL,
  template_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts smallint NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key),
  FOREIGN KEY (business_id, appointment_id)
    REFERENCES public.appointments(business_id, id) ON DELETE SET NULL (appointment_id)
);

CREATE INDEX message_outbox_queue_idx ON public.message_outbox (available_at) WHERE status IN ('queued', 'failed');

CREATE OR REPLACE FUNCTION public.is_active_business_member(target_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_memberships membership
    WHERE membership.business_id = target_business_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(target_business_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_memberships membership
    WHERE membership.business_id = target_business_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND membership.role = ANY (allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_business_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_business_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_business_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, text[]) TO authenticated, service_role;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_member_read ON public.businesses
  FOR SELECT TO authenticated USING (public.is_active_business_member(id));
CREATE POLICY businesses_admin_update ON public.businesses
  FOR UPDATE TO authenticated
  USING (public.has_business_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_business_role(id, ARRAY['owner', 'admin']));

CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY memberships_member_read ON public.business_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_business_role(business_id, ARRAY['owner', 'admin']));
CREATE POLICY memberships_admin_manage ON public.business_memberships
  FOR ALL TO authenticated
  USING (public.has_business_role(business_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['owner', 'admin']));

CREATE POLICY customers_member_access ON public.customers
  FOR ALL TO authenticated
  USING (public.is_active_business_member(business_id))
  WITH CHECK (public.is_active_business_member(business_id));
CREATE POLICY services_member_read ON public.services
  FOR SELECT TO authenticated USING (public.is_active_business_member(business_id));
CREATE POLICY services_admin_manage ON public.services
  FOR ALL TO authenticated
  USING (public.has_business_role(business_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['owner', 'admin']));
CREATE POLICY business_hours_member_access ON public.business_hours
  FOR ALL TO authenticated
  USING (public.is_active_business_member(business_id))
  WITH CHECK (public.is_active_business_member(business_id));
CREATE POLICY schedule_exceptions_member_access ON public.schedule_exceptions
  FOR ALL TO authenticated
  USING (public.is_active_business_member(business_id))
  WITH CHECK (public.is_active_business_member(business_id));
CREATE POLICY appointments_member_access ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_active_business_member(business_id))
  WITH CHECK (public.is_active_business_member(business_id));
CREATE POLICY whatsapp_admin_read ON public.whatsapp_integrations
  FOR SELECT TO authenticated
  USING (public.has_business_role(business_id, ARRAY['owner', 'admin']));
CREATE POLICY message_outbox_admin_read ON public.message_outbox
  FOR SELECT TO authenticated
  USING (public.has_business_role(business_id, ARRAY['owner', 'admin']));

REVOKE ALL PRIVILEGES ON TABLE
  public.businesses,
  public.profiles,
  public.business_memberships,
  public.customers,
  public.services,
  public.business_hours,
  public.schedule_exceptions,
  public.appointments,
  public.otp_challenges,
  public.whatsapp_integrations,
  public.message_outbox
FROM anon;

GRANT SELECT, UPDATE ON public.businesses TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_exceptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT ON public.whatsapp_integrations, public.message_outbox TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

COMMIT;
