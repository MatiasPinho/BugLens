drop function if exists public.upsert_bug_status(uuid, text, text, text, public.bug_status);

create function public.upsert_bug_status(
  target_project_id uuid,
  target_content_key text,
  bug_title text,
  bug_description text,
  next_status public.bug_status
)
returns table (bug_id uuid, status public.bug_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_bug_id uuid;
  previous_status public.bug_status;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.has_project_role(
    target_project_id,
    array['owner', 'admin', 'editor']::public.project_role[]
  ) then
    raise exception 'No tenés permisos para cambiar bugs en este proyecto.';
  end if;

  insert into public.bugs (
    project_id,
    content_key,
    title,
    description,
    status,
    created_by,
    updated_by
  )
  values (
    target_project_id,
    target_content_key,
    bug_title,
    bug_description,
    next_status,
    current_user_id,
    current_user_id
  )
  on conflict (project_id, content_key) do update
    set
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      updated_by = current_user_id,
      deleted_at = null
  returning public.bugs.id, public.bugs.status
  into saved_bug_id, previous_status;

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
    'status_changed',
    next_status,
    jsonb_build_object('content_key', target_content_key)
  );

  return query select saved_bug_id, next_status;
end;
$$;
