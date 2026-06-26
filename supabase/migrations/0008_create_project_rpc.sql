drop function if exists public.create_project(text, text);

create function public.create_project(project_name text, project_slug text)
returns table (project_id uuid, project_name_result text, project_slug_result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := auth.jwt() ->> 'email';
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  insert into public.profiles (id, email, display_name)
  values (current_user_id, current_email, current_email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email);

  insert into public.projects (name, slug, owner_id)
  values (project_name, project_slug, current_user_id)
  on conflict (slug) do nothing;

  insert into public.project_members (project_id, user_id, role)
  select public.projects.id, current_user_id, 'owner'
  from public.projects
  where public.projects.slug = project_slug
  on conflict on constraint project_members_pkey do update
    set role = 'owner';

  return query
  select public.projects.id, public.projects.name, public.projects.slug
  from public.projects
  where public.projects.slug = project_slug;
end;
$$;
