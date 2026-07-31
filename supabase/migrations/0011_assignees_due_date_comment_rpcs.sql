-- Operaciones sobre lo que agregó 0010. Todas siguen el patrón del resto de los
-- RPCs: `security definer`, chequeo explícito de sesión y de rol, e historial en
-- `bug_events`.

-- ── Responsables ────────────────────────────────────────────────────────────
-- Reemplaza el conjunto completo: la UI manda con quiénes queda el bug, no un
-- delta. Así dos clientes concurrentes convergen al mismo estado.
drop function if exists public.set_bug_assignees(uuid, text, uuid[]);

create function public.set_bug_assignees(
  target_project_id uuid,
  target_content_key text,
  next_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_bug_id uuid;
  added_ids uuid[];
  removed_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.has_project_role(
    target_project_id,
    array['owner', 'admin', 'editor']::public.project_role[]
  ) then
    raise exception 'No tenés permisos para asignar bugs en este proyecto.';
  end if;

  select id into target_bug_id
  from public.bugs
  where project_id = target_project_id
    and content_key = target_content_key
    and deleted_at is null;

  if target_bug_id is null then
    raise exception 'Bug no encontrado.';
  end if;

  -- Solo miembros del proyecto pueden ser responsables.
  if exists (
    select 1
    from unnest(coalesce(next_user_ids, '{}'::uuid[])) as candidate(user_id)
    where not exists (
      select 1
      from public.project_members
      where project_members.project_id = target_project_id
        and project_members.user_id = candidate.user_id
    )
  ) then
    raise exception 'Solo se puede asignar a miembros del proyecto.';
  end if;

  select coalesce(array_agg(user_id), '{}'::uuid[]) into removed_ids
  from public.bug_assignees
  where bug_id = target_bug_id
    and user_id <> all (coalesce(next_user_ids, '{}'::uuid[]));

  select coalesce(array_agg(candidate.user_id), '{}'::uuid[]) into added_ids
  from unnest(coalesce(next_user_ids, '{}'::uuid[])) as candidate(user_id)
  where not exists (
    select 1
    from public.bug_assignees
    where bug_assignees.bug_id = target_bug_id
      and bug_assignees.user_id = candidate.user_id
  );

  delete from public.bug_assignees
  where bug_id = target_bug_id
    and user_id <> all (coalesce(next_user_ids, '{}'::uuid[]));

  insert into public.bug_assignees (bug_id, project_id, user_id, assigned_by)
  select target_bug_id, target_project_id, candidate.user_id, current_user_id
  from unnest(coalesce(next_user_ids, '{}'::uuid[])) as candidate(user_id)
  on conflict (bug_id, user_id) do nothing;

  update public.bugs
  set updated_by = current_user_id
  where id = target_bug_id;

  if array_length(added_ids, 1) is not null then
    insert into public.bug_events (bug_id, project_id, actor_id, event_type, payload)
    values (
      target_bug_id,
      target_project_id,
      current_user_id,
      'assigned',
      jsonb_build_object('content_key', target_content_key, 'user_ids', added_ids)
    );
  end if;

  if array_length(removed_ids, 1) is not null then
    insert into public.bug_events (bug_id, project_id, actor_id, event_type, payload)
    values (
      target_bug_id,
      target_project_id,
      current_user_id,
      'unassigned',
      jsonb_build_object('content_key', target_content_key, 'user_ids', removed_ids)
    );
  end if;

  return target_bug_id;
end;
$$;

-- ── Fecha límite ────────────────────────────────────────────────────────────
-- `next_due` en null limpia la fecha; es la forma de sacar el compromiso.
drop function if exists public.set_bug_due_date(uuid, text, date);

create function public.set_bug_due_date(
  target_project_id uuid,
  target_content_key text,
  next_due date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_bug_id uuid;
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

  update public.bugs
  set
    due_date = next_due,
    updated_by = current_user_id
  where project_id = target_project_id
    and content_key = target_content_key
    and deleted_at is null
  returning id into target_bug_id;

  if target_bug_id is null then
    raise exception 'Bug no encontrado.';
  end if;

  insert into public.bug_events (bug_id, project_id, actor_id, event_type, payload)
  values (
    target_bug_id,
    target_project_id,
    current_user_id,
    'due_date_changed',
    jsonb_build_object('content_key', target_content_key, 'due_date', next_due)
  );

  return target_bug_id;
end;
$$;

-- ── Comentarios con hilo ────────────────────────────────────────────────────
-- Va por RPC y no por insert directo para poder validar que el padre pertenezca
-- al mismo bug: si no, un hilo podría colgar de un comentario de otro reporte.
drop function if exists public.add_bug_comment(uuid, text, text, uuid);

create function public.add_bug_comment(
  target_project_id uuid,
  target_content_key text,
  comment_body text,
  parent_comment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_bug_id uuid;
  created public.bug_comments;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.is_project_member(target_project_id) then
    raise exception 'No tenés permisos para comentar en este proyecto.';
  end if;

  if comment_body is null or btrim(comment_body) = '' then
    raise exception 'El comentario no puede estar vacío.';
  end if;

  select id into target_bug_id
  from public.bugs
  where project_id = target_project_id
    and content_key = target_content_key
    and deleted_at is null;

  if target_bug_id is null then
    raise exception 'Bug no encontrado.';
  end if;

  if parent_comment_id is not null then
    if not exists (
      select 1
      from public.bug_comments
      where id = parent_comment_id
        and bug_id = target_bug_id
    ) then
      raise exception 'El comentario padre no pertenece a este bug.';
    end if;
  end if;

  insert into public.bug_comments (bug_id, project_id, body, parent_id, created_by)
  values (target_bug_id, target_project_id, btrim(comment_body), parent_comment_id, current_user_id)
  returning * into created;

  insert into public.bug_events (bug_id, project_id, actor_id, event_type, payload)
  values (
    target_bug_id,
    target_project_id,
    current_user_id,
    'commented',
    jsonb_build_object('content_key', target_content_key, 'comment_id', created.id)
  );

  return jsonb_build_object(
    'id', created.id,
    'body', created.body,
    'parentId', created.parent_id,
    'createdAt', created.created_at,
    'updatedAt', created.updated_at,
    'authorId', created.created_by,
    'authorEmail', (select email from public.profiles where id = current_user_id),
    'upvotes', 0,
    'downvotes', 0,
    'myVote', 0
  );
end;
$$;

-- ── Voto ────────────────────────────────────────────────────────────────────
-- `next_value` en 0 retira el voto. Votar de nuevo lo mismo también lo retira:
-- eso hace que el botón funcione como toggle desde el cliente sin estado extra.
drop function if exists public.set_comment_vote(uuid, smallint);

create function public.set_comment_vote(
  target_comment_id uuid,
  next_value smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_project_id uuid;
  existing_value smallint;
  applied_value smallint;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if next_value not in (-1, 0, 1) then
    raise exception 'Voto inválido.';
  end if;

  select project_id into target_project_id
  from public.bug_comments
  where id = target_comment_id;

  if target_project_id is null then
    raise exception 'Comentario no encontrado.';
  end if;

  if not public.is_project_member(target_project_id) then
    raise exception 'No tenés permisos para votar en este proyecto.';
  end if;

  select value into existing_value
  from public.bug_comment_votes
  where comment_id = target_comment_id
    and user_id = current_user_id;

  if next_value = 0 or existing_value = next_value then
    delete from public.bug_comment_votes
    where comment_id = target_comment_id
      and user_id = current_user_id;
    applied_value := 0;
  else
    insert into public.bug_comment_votes (comment_id, project_id, user_id, value)
    values (target_comment_id, target_project_id, current_user_id, next_value)
    on conflict (comment_id, user_id) do update set value = excluded.value;
    applied_value := next_value;
  end if;

  return (
    select jsonb_build_object(
      'commentId', target_comment_id,
      'upvotes', coalesce(count(*) filter (where value = 1), 0),
      'downvotes', coalesce(count(*) filter (where value = -1), 0),
      'myVote', applied_value
    )
    from public.bug_comment_votes
    where comment_id = target_comment_id
  );
end;
$$;
