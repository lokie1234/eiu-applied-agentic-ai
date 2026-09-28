-- Migration: 202609250001_ai_knowledge.sql
-- Description: Private Knowledge AI module tables

create table if not exists public.ai_knowledge_bases (
  id text primary key default gen_random_uuid()::text,
  name text not null default 'default',
  gemini_store_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_documents (
  id text primary key default gen_random_uuid()::text,
  knowledge_base_id text not null references public.ai_knowledge_bases(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size bigint not null default 0,
  gemini_file_name text,
  gemini_document_name text,
  status text not null default 'PROCESSING' check (status in ('UPLOADING', 'PROCESSING', 'READY', 'ERROR')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_rules (
  id text primary key default gen_random_uuid()::text,
  knowledge_base_id text not null references public.ai_knowledge_bases(id) on delete cascade,
  system_prompt text not null,
  fallback_message text not null default 'Không tìm thấy thông tin này trong cơ sở dữ liệu được cung cấp.',
  require_citation boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists idx_ai_documents_kb_id on public.ai_documents(knowledge_base_id);
create index if not exists idx_ai_documents_status on public.ai_documents(status);
create unique index if not exists idx_ai_rules_kb_id on public.ai_rules(knowledge_base_id);

-- Enable RLS
alter table public.ai_knowledge_bases enable row level security;
alter table public.ai_documents enable row level security;
alter table public.ai_rules enable row level security;

-- Drop existing policies if re-run
drop policy if exists "Service role access for ai_knowledge_bases" on public.ai_knowledge_bases;
drop policy if exists "Service role access for ai_documents" on public.ai_documents;
drop policy if exists "Service role access for ai_rules" on public.ai_rules;

-- Policies: only service role has full access
create policy "Service role access for ai_knowledge_bases" on public.ai_knowledge_bases
  for all using (auth.role() = 'service_role');

create policy "Service role access for ai_documents" on public.ai_documents
  for all using (auth.role() = 'service_role');

create policy "Service role access for ai_rules" on public.ai_rules
  for all using (auth.role() = 'service_role');
