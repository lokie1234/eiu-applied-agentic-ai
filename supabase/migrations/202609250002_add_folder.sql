-- Migration: 202609250002_add_folder.sql
-- Description: Add folder and content_text to ai_documents for categorization and Fast-Mode

alter table if exists public.ai_documents 
  add column if not exists folder text not null default 'Chung',
  add column if not exists content_text text;

create index if not exists idx_ai_documents_folder on public.ai_documents(folder);
