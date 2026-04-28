-- Session RC d'un utilisateur
create table rc_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_paid boolean default false,
  stripe_payment_intent_id text,
  data jsonb default '{}'::jsonb
);

-- Étapes du flow pour une session
create table rc_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references rc_sessions(id) on delete cascade,
  step_id text not null,
  status text default 'locked',
  completed_at timestamptz,
  extracted_data jsonb default '{}'::jsonb
);

-- Documents uploadés
create table rc_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references rc_sessions(id) on delete cascade,
  step_id text not null,
  file_name text not null,
  storage_path text not null,
  extracted_data jsonb default '{}'::jsonb,
  uploaded_at timestamptz default now()
);

-- Messages du chat par étape
create table rc_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references rc_sessions(id) on delete cascade,
  step_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

-- RLS policies
alter table rc_sessions enable row level security;
alter table rc_steps enable row level security;
alter table rc_documents enable row level security;
alter table rc_messages enable row level security;

create policy "Users own their sessions" on rc_sessions
  for all using (auth.uid() = user_id);

create policy "Users own their steps" on rc_steps
  for all using (
    session_id in (select id from rc_sessions where user_id = auth.uid())
  );

create policy "Users own their documents" on rc_documents
  for all using (
    session_id in (select id from rc_sessions where user_id = auth.uid())
  );

create policy "Users own their messages" on rc_messages
  for all using (
    session_id in (select id from rc_sessions where user_id = auth.uid())
  );

-- Bucket storage pour les PDFs
insert into storage.buckets (id, name, public) values ('rc-documents', 'rc-documents', false);

create policy "Users can upload their own documents" on storage.objects
  for insert with check (
    bucket_id = 'rc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read their own documents" on storage.objects
  for select using (
    bucket_id = 'rc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
