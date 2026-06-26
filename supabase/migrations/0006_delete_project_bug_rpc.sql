drop function if exists public.delete_project_bug(uuid, text);

create function public.delete_project_bug(
  target_project_id uuid,
  target_content_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_bug_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.has_project_role(
    target_project_id,
    array['owner', 'admin', 'editor']::public.project_role[]
  ) then
    raise exception 'No tenés permisos para borrar bugs en este proyecto.';
  end if;

  update public.bugs
  set
    deleted_at = now(),
    updated_by = current_user_id
  where public.bugs.project_id = target_project_id
    and public.bugs.content_key = target_content_key
    and public.bugs.deleted_at is null
  returning public.bugs.id into saved_bug_id;

  if saved_bug_id is null then
    raise exception 'Bug no encontrado.';
  end if;

  insert into public.bug_events (
    bug_id,
    project_id,
    actor_id,
    event_type,
    payload
  )
  values (
    saved_bug_id,
    target_project_id,
    current_user_id,
    'deleted',
    jsonb_build_object('content_key', target_content_key)
  );

  return saved_bug_id;
end;
$$;
