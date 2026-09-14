ALTER TABLE public.agent_state ADD COLUMN autonomous boolean NOT NULL DEFAULT true;
ALTER TABLE public.agent_state ADD COLUMN cost_tick bigint NOT NULL DEFAULT 0;