
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_chairman_unique ON public.user_roles ((role)) WHERE role = 'chairman';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_meetings_unique ON public.user_roles ((role)) WHERE role = 'head_meetings';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_events_unique ON public.user_roles ((role)) WHERE role = 'head_events';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_trips_unique ON public.user_roles ((role)) WHERE role = 'head_trips';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_finance_unique ON public.user_roles ((role)) WHERE role = 'head_finance';
