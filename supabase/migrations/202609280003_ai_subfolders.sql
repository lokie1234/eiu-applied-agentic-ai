-- Add nested subfolders and scope vector retrieval to a selected leaf.
-- Apply after 202609280002_ai_folder_scope.sql.

alter table if exists public.ai_documents
  add column if not exists subfolder text not null default '';

alter table if exists public.ai_document_chunks
  add column if not exists subfolder text not null default '';

update public.ai_document_chunks as chunks
set subfolder = coalesce(documents.subfolder, '')
from public.ai_documents as documents
where chunks.document_id = documents.id;

create index if not exists idx_ai_document_chunks_scope
  on public.ai_document_chunks(knowledge_base_id, folder, subfolder);

create or replace function public.match_ai_document_chunks(
  query_embedding extensions.vector(768),
  filter_knowledge_base_id text,
  filter_folder text,
  filter_subfolder text default '',
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
    and (filter_subfolder = '' or chunks.subfolder = filter_subfolder)
  order by chunks.embedding <=> query_embedding
  limit greatest(1, least(match_count, 12));
$$;

revoke all on function public.match_ai_document_chunks(extensions.vector, text, text, text, integer) from public;
grant execute on function public.match_ai_document_chunks(extensions.vector, text, text, text, integer) to service_role;
