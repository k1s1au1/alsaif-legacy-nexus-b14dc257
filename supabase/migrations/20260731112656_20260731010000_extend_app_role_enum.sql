/*
# Extend app_role enum with all required values

Adds the following roles to the app_role enum type:
- chairman: the family council chairman
- head_meetings, head_events, head_trips, head_finance, head_heritage: section heads

These are used throughout the frontend but were missing from the database enum.
*/

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chairman';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_meetings';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_events';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_trips';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_heritage';
