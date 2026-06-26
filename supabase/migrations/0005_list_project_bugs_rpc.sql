drop function if exists public.list_project_bugs(uuid, integer);

create function public.list_project_bugs(
  target_project_id uuid,
  result_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  bugs_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.is_project_member(target_project_id) then
    raise exception 'No tenés permisos para ver bugs de este proyecto.';
  end if;

  select coalesce(jsonb_agg(row_payload order by updated_at desc), '[]'::jsonb)
  into bugs_payload
  from (
    select
      public.bugs.updated_at,
      jsonb_build_object(
        'bugId', public.bugs.id,
        'contentKey', public.bugs.content_key,
        'status', public.bugs.status,
        'rawBug', coalesce(
          latest_occurrence.raw_bug,
          jsonb_build_object(
            'id', public.bugs.id::text,
            'rowIndex', 0,
            'title', public.bugs.title,
            'description', public.bugs.description,
            'rawRow', '{}'::jsonb,
            'googleDocLinks', '[]'::jsonb
          )
        ),
        'analysis', coalesce(
          latest_run.analysis,
          jsonb_build_object(
            'category', coalesce(public.bugs.category, 'otro'::public.bug_category),
            'severity', coalesce(public.bugs.severity, 'low'::public.bug_severity),
            'bugType', public.bugs.bug_type,
            'confidence', coalesce(public.bugs.confidence, 0),
            'affectedArea', coalesce(public.bugs.affected_area, 'No informado'),
            'summary', coalesce(public.bugs.summary, public.bugs.title),
            'rewritten', jsonb_build_object(
              'observed', public.bugs.description,
              'expected', 'No informado',
              'steps', '[]'::jsonb,
              'environment', 'No informado',
              'problemCount', 1
            ),
            'missingInformation', '[]'::jsonb,
            'rawResponse', ''
          )
        ),
        'googleDocs', coalesce(latest_run.enriched_docs, '[]'::jsonb),
        'error', latest_run.error,
        'processingMs', coalesce(latest_run.processing_ms, 0)
      ) as row_payload
    from public.bugs
    left join lateral (
      select
        public.bug_analysis_runs.analysis,
        public.bug_analysis_runs.enriched_docs,
        public.bug_analysis_runs.error,
        public.bug_analysis_runs.processing_ms,
        public.bug_analysis_runs.occurrence_id
      from public.bug_analysis_runs
      where public.bug_analysis_runs.bug_id = public.bugs.id
      order by public.bug_analysis_runs.created_at desc
      limit 1
    ) latest_run on true
    left join public.bug_occurrences latest_occurrence
      on latest_occurrence.id = latest_run.occurrence_id
    where public.bugs.project_id = target_project_id
      and public.bugs.deleted_at is null
    order by public.bugs.updated_at desc
    limit greatest(result_limit, 0)
  ) rows;

  return bugs_payload;
end;
$$;
