-- Scope vector retrieval to the folder explicitly selected in AI Chat.
-- Apply after 202609280001_ai_fast_retrieval.sql.

-- Keep this migration safe for databases where the older optional
-- 202609250002_add_folder.sql migration was not applied.
alter table if exists public.ai_documents
  add column if not exists folder text not null default 'Chung',
  add column if not exists content_text text;

-- Older uploads stored their folder as "folder:<name>" in gemini_file_name.
-- Recover that value before propagating it to the local vector chunks.
update public.ai_documents
set folder = case
  when gemini_file_name like 'folder:%'
    then coalesce(nullif(trim(substring(gemini_file_name from 8)), ''), 'Chung')
  else coalesce(nullif(trim(folder), ''), 'Chung')
end;

alter table if exists public.ai_document_chunks
  add column if not exists folder text not null default 'Chung';

update public.ai_document_chunks as chunks
set folder = coalesce(nullif(trim(documents.folder), ''), 'Chung')
from public.ai_documents as documents
where chunks.document_id = documents.id;

create index if not exists idx_ai_document_chunks_kb_folder
  on public.ai_document_chunks(knowledge_base_id, folder);

create or replace function public.match_ai_document_chunks(
  query_embedding extensions.vector(768),
  filter_knowledge_base_id text,
  filter_folder text,
  match_count integer default 6
)
returns table (
  document_id text,
  filename text,
  page_number integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chunks.document_id,
    chunks.filename,
    chunks.page_number,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.ai_document_chunks as chunks
  where chunks.knowledge_base_id = filter_knowledge_base_id
    and chunks.folder = filter_folder
  order by chunks.embedding <=> query_embedding
  limit greatest(1, least(match_count, 12));
$$;

revoke all on function public.match_ai_document_chunks(extensions.vector, text, text, integer) from public;
grant execute on function public.match_ai_document_chunks(extensions.vector, text, text, integer) to service_role;
