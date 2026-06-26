drop function if exists public.create_bug_import(uuid, public.import_source_type, text, text, integer, jsonb);
drop function if exists public.save_analysis_result(uuid, public.import_source_type, integer, text, uuid, text, public.bug_status, jsonb, text[], jsonb, jsonb, text, text, text, text, integer);

create function public.create_bug_import(
  target_project_id uuid,
  input_source_type public.import_source_type,
  input_source_name text,
  input_source_path text,
  input_row_count integer,
  input_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_import_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.has_project_role(
    target_project_id,
    array['owner', 'admin', 'editor']::public.project_role[]
  ) then
    raise exception 'No tenés permisos para importar bugs en este proyecto.';
  end if;

  insert into public.bug_imports (
    project_id,
    source_type,
    source_name,
    source_path,
    row_count,
    metadata,
    created_by
  )
  values (
    target_project_id,
    input_source_type,
    input_source_name,
    input_source_path,
    input_row_count,
    coalesce(input_metadata, '{}'::jsonb),
    current_user_id
  )
  returning id into saved_import_id;

  return saved_import_id;
end;
$$;

create function public.save_analysis_result(
  target_project_id uuid,
  input_source_type public.import_source_type,
  input_source_row_index integer,
  input_source_bug_id text,
  target_import_id uuid,
  target_content_key text,
  target_status public.bug_status,
  input_raw_bug jsonb,
  input_google_doc_links text[],
  input_enriched_docs jsonb,
  input_analysis jsonb,
  input_provider text,
  input_model text,
  input_prompt_version text,
  input_error text,
  input_processing_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_bug_id uuid;
  saved_occurrence_id uuid;
  analysis_category public.bug_category;
  analysis_severity public.bug_severity;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.has_project_role(
    target_project_id,
    array['owner', 'admin', 'editor']::public.project_role[]
  ) then
    raise exception 'No tenés permisos para guardar bugs en este proyecto.';
  end if;

  analysis_category := nullif(input_analysis ->> 'category', '')::public.bug_category;
  analysis_severity := nullif(input_analysis ->> 'severity', '')::public.bug_severity;

  insert into public.bugs (
    project_id,
    content_key,
    title,
    description,
    status,
    category,
    severity,
    bug_type,
    affected_area,
    summary,
    confidence,
    created_by,
    updated_by,
    deleted_at
  )
  values (
    target_project_id,
    target_content_key,
    input_raw_bug ->> 'title',
    coalesce(input_raw_bug ->> 'description', ''),
    target_status,
    analysis_category,
    analysis_severity,
    input_analysis ->> 'bugType',
    input_analysis ->> 'affectedArea',
    input_analysis ->> 'summary',
    nullif(input_analysis ->> 'confidence', '')::numeric,
    current_user_id,
    current_user_id,
    null
  )
  on conflict (project_id, content_key) do update
    set
      title = excluded.title,
      description = excluded.description,
      status = public.bugs.status,
      category = excluded.category,
      severity = excluded.severity,
      bug_type = excluded.bug_type,
      affected_area = excluded.affected_area,
      summary = excluded.summary,
      confidence = excluded.confidence,
      updated_by = current_user_id,
      deleted_at = null
  returning public.bugs.id into saved_bug_id;

  insert into public.bug_occurrences (
    bug_id,
    project_id,
    import_id,
    source_type,
    source_row_index,
    source_bug_id,
    raw_bug,
    google_doc_links
  )
  values (
    saved_bug_id,
    target_project_id,
    target_import_id,
    input_source_type,
    input_source_row_index,
    input_source_bug_id,
    input_raw_bug,
    coalesce(input_google_doc_links, '{}')
  )
  returning id into saved_occurrence_id;

  insert into public.bug_analysis_runs (
    bug_id,
    project_id,
    occurrence_id,
    import_id,
    provider,
    model,
    prompt_version,
    analysis,
    enriched_docs,
    raw_response,
    error,
    processing_ms,
    created_by
  )
  values (
    saved_bug_id,
    target_project_id,
    saved_occurrence_id,
    target_import_id,
    input_provider,
    input_model,
    input_prompt_version,
    input_analysis,
    coalesce(input_enriched_docs, '[]'::jsonb),
    input_analysis ->> 'rawResponse',
    input_error,
    greatest(input_processing_ms, 0),
    current_user_id
  );

  insert into public.bug_events (
    bug_id,
    project_id,
    actor_id,
    event_type,
    to_status,
    payload
  )
  values (
    saved_bug_id,
    target_project_id,
    current_user_id,
    'analyzed',
    target_status,
    jsonb_build_object('content_key', target_content_key, 'import_id', target_import_id)
  );

  return saved_bug_id;
end;
$$;
