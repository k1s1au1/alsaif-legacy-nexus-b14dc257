create table if not exists public.user_fcm_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  device_type text,
  created_at timestamp with time zone default now() not null,
  unique(user_id, token)
);

alter table public.user_fcm_tokens enable row level security;

create policy "Users can manage their own tokens"
  on public.user_fcm_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
