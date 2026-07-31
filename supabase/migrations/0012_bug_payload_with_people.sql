-- `list_project_bugs` pasa a devolver lo que el rediseño necesita: responsables,
-- fecha límite, comentarios con hilo y voto, y el historial de actividad.
--
-- Los comentarios se devuelven PLANOS, con `parentId`. El árbol lo arma el
-- cliente: en SQL una recursiva acá complica el payload sin ganar nada, y la
-- profundidad real de un hilo de QA es de dos o tres niveles.

-- Miembros del proyecto: alimenta el avatar stack del topbar y el selector de
-- responsables. Sin esto la UI no tiene a quién ofrecer.
drop function if exists public.list_project_members(uuid);

create function public.list_project_members(target_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  members_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.is_project_member(target_project_id) then
    raise exception 'No tenés permisos para ver este proyecto.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', public.profiles.id,
        'email', public.profiles.email,
        'displayName', public.profiles.display_name,
        'role', public.project_members.role
      )
      order by public.profiles.email
    ),
    '[]'::jsonb
  )
  into members_payload
  from public.project_members
  join public.profiles on public.profiles.id = public.project_members.user_id
  where public.project_members.project_id = target_project_id;

  return members_payload;
end;
$$;

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
        'dueDate', public.bugs.due_date,
        'assignees', coalesce(assignees.items, '[]'::jsonb),
        'reportedBy', case
          when reporter.id is null then null
          else jsonb_build_object(
            'id', reporter.id,
            'email', reporter.email,
            'displayName', reporter.display_name
          )
        end,
        'createdAt', public.bugs.created_at,
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
        'externalAgentHistory', coalesce(agent_runs.items, '[]'::jsonb),
        'comments', coalesce(comments.items, '[]'::jsonb),
        'activity', coalesce(activity.items, '[]'::jsonb),
        'googleDocs', coalesce(latest_run.enriched_docs, '[]'::jsonb),
        'error', latest_run.error,
        'processingMs', coalesce(latest_run.processing_ms, 0)
      ) as row_payload
    from public.bugs
    left join public.profiles reporter on reporter.id = public.bugs.created_by
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
    left join lateral (
      select coalesce(
        jsonb_agg(
          (public.bug_analysis_runs.analysis -> 'externalAgent')
          || jsonb_build_object('createdAt', public.bug_analysis_runs.created_at)
          order by public.bug_analysis_runs.created_at desc
        ),
        '[]'::jsonb
      ) as items
      from public.bug_analysis_runs
      where public.bug_analysis_runs.bug_id = public.bugs.id
        and public.bug_analysis_runs.provider = 'external-agent'
        and public.bug_analysis_runs.analysis ? 'externalAgent'
    ) agent_runs on true
    left join lateral (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', public.profiles.id,
            'email', public.profiles.email,
            'displayName', public.profiles.display_name
          )
          order by public.profiles.email
        ),
        '[]'::jsonb
      ) as items
      from public.bug_assignees
      join public.profiles on public.profiles.id = public.bug_assignees.user_id
      where public.bug_assignees.bug_id = public.bugs.id
    ) assignees on true
    left join lateral (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', threaded.id,
            'parentId', threaded.parent_id,
            'body', threaded.body,
            'createdAt', threaded.created_at,
            'updatedAt', threaded.updated_at,
            'authorId', threaded.created_by,
            'authorEmail', threaded.author_email,
            'authorName', threaded.author_name,
            'upvotes', threaded.upvotes,
            'downvotes', threaded.downvotes,
            'myVote', threaded.my_vote
          )
          order by threaded.created_at
        ),
        '[]'::jsonb
      ) as items
      from (
        select
          public.bug_comments.id,
          public.bug_comments.parent_id,
          public.bug_comments.body,
          public.bug_comments.created_at,
          public.bug_comments.updated_at,
          public.bug_comments.created_by,
          public.profiles.email as author_email,
          public.profiles.display_name as author_name,
          coalesce(count(votes.user_id) filter (where votes.value = 1), 0) as upvotes,
          coalesce(count(votes.user_id) filter (where votes.value = -1), 0) as downvotes,
          coalesce(
            max(votes.value) filter (where votes.user_id = current_user_id),
            0
          ) as my_vote
        from public.bug_comments
        left join public.profiles on public.profiles.id = public.bug_comments.created_by
        left join public.bug_comment_votes votes
          on votes.comment_id = public.bug_comments.id
        where public.bug_comments.bug_id = public.bugs.id
        group by
          public.bug_comments.id,
          public.profiles.email,
          public.profiles.display_name
      ) threaded
    ) comments on true
    left join lateral (
      -- Feed de actividad. Se corta en 50: el panel muestra los últimos
      -- movimientos, no la auditoría completa.
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', recent.id,
            'type', recent.event_type,
            'fromStatus', recent.from_status,
            'toStatus', recent.to_status,
            'payload', recent.payload,
            'createdAt', recent.created_at,
            'actorId', recent.actor_id,
            'actorEmail', recent.actor_email,
            'actorName', recent.actor_name
          )
          order by recent.created_at desc
        ),
        '[]'::jsonb
      ) as items
      from (
        select
          public.bug_events.id,
          public.bug_events.event_type,
          public.bug_events.from_status,
          public.bug_events.to_status,
          public.bug_events.payload,
          public.bug_events.created_at,
          public.bug_events.actor_id,
          public.profiles.email as actor_email,
          public.profiles.display_name as actor_name
        from public.bug_events
        left join public.profiles on public.profiles.id = public.bug_events.actor_id
        where public.bug_events.bug_id = public.bugs.id
        order by public.bug_events.created_at desc
        limit 50
      ) recent
    ) activity on true
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
