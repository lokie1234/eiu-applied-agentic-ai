-- Support renaming display folders without breaking immutable Gemini File Search metadata.
-- Apply after 202609280004_ai_document_only_scope.sql.

alter table if exists public.ai_documents
  add column if not exists file_search_folder text,
  add column if not exists file_search_subfolder text;

update public.ai_documents
set
  file_search_folder = coalesce(file_search_folder, folder, 'Chung'),
  file_search_subfolder = coalesce(file_search_subfolder, subfolder, '');

alter table if exists public.ai_documents
  alter column file_search_folder set default 'Chung',
  alter column file_search_folder set not null,
  alter column file_search_subfolder set default '',
  alter column file_search_subfolder set not null;

create or replace function public.rename_ai_document_scope(
  filter_knowledge_base_id text,
  old_folder text,
  old_subfolder text,
  new_name text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
  updated_count integer := 0;
begin
  if normalized_name = '' or length(normalized_name) > 100 then
    raise exception 'Tên thư mục phải có từ 1 đến 100 ký tự.' using errcode = '22023';
  end if;

  if old_subfolder <> '' then
    if normalized_name = old_subfolder then
      return 0;
    end if;

    if exists (
      select 1
      from public.ai_documents
      where knowledge_base_id = filter_knowledge_base_id
        and folder = old_folder
        and subfolder = normalized_name
    ) then
      raise exception 'Folder nhỏ "%" đã tồn tại trong "%".', normalized_name, old_folder
        using errcode = '23505';
    end if;

    update public.ai_documents
    set subfolder = normalized_name
    where knowledge_base_id = filter_knowledge_base_id
      and folder = old_folder
      and subfolder = old_subfolder;
    get diagnostics updated_count = row_count;

    update public.ai_document_chunks
    set subfolder = normalized_name
    where knowledge_base_id = filter_knowledge_base_id
      and folder = old_folder
      and subfolder = old_subfolder;
  else
    if normalized_name = old_folder then
      return 0;
    end if;

    if exists (
      select 1
      from public.ai_documents
      where knowledge_base_id = filter_knowledge_base_id
        and folder = normalized_name
    ) then
      raise exception 'Thư mục "%" đã tồn tại.', normalized_name using errcode = '23505';
    end if;

    update public.ai_documents
    set folder = normalized_name
    where knowledge_base_id = filter_knowledge_base_id
      and folder = old_folder;
    get diagnostics updated_count = row_count;

    update public.ai_document_chunks
    set folder = normalized_name
    where knowledge_base_id = filter_knowledge_base_id
      and folder = old_folder;
  end if;

  delete from public.ai_response_cache
  where knowledge_base_id = filter_knowledge_base_id;

  return updated_count;
end;
$$;

revoke all on function public.rename_ai_document_scope(text, text, text, text) from public;
grant execute on function public.rename_ai_document_scope(text, text, text, text) to service_role;

-- A selected root folder and a selected subfolder are both exact retrieval scopes.
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
    and chunks.subfolder = filter_subfolder
    and lower(chunks.filename) ~ '\.(pdf|txt|md)$'
  order by chunks.embedding <=> query_embedding
  limit greatest(1, least(match_count, 12));
$$;

revoke all on function public.match_ai_document_chunks(extensions.vector, text, text, text, integer) from public;
grant execute on function public.match_ai_document_chunks(extensions.vector, text, text, text, integer) to service_role;
