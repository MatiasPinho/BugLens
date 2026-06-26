-- buglens team workspace schema.
-- Source of truth for shared projects, bugs, imports, analysis results and audit history.

create extension if not exists pgcrypto;

create type public.project_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.bug_status as enum (
  'nuevo',
  'en_progreso',
  'solucionado',
  'cerrado',
  'no_replicado'
);
create type public.bug_category as enum ('frontend', 'backend', 'database', 'config', 'data', 'otro');
create type public.bug_severity as enum ('low', 'medium', 'high', 'critical');
create type public.import_source_type as enum ('excel', 'manual');
create type public.bug_event_type as enum (
  'created',
  'imported',
  'analyzed',
  'status_changed',
  'assigned',
  'deleted',
  'commented',
  'restored'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.bug_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type public.import_source_type not null,
  source_name text,
  source_path text,
  row_count integer not null default 0 check (row_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A bug is the deduplicated team item. Its identity is still content-based:
-- same project + same content_key = same shared bug, even if it appears in many imports.
create table public.bugs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  content_key text not null,
  title text not null,
  description text not null default '',
  status public.bug_status not null default 'nuevo',
  category public.bug_category,
  severity public.bug_severity,
  bug_type text,
  affected_area text,
  summary text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, content_key)
);

-- Every Excel/manual load can create an occurrence. This preserves row-level evidence
-- without duplicating the shared bug state.
create table public.bug_occurrences (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  import_id uuid references public.bug_imports (id) on delete set null,
  source_type public.import_source_type not null,
  source_row_index integer check (source_row_index is null or source_row_index >= 0),
  source_bug_id text,
  raw_bug jsonb not null,
  google_doc_links text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Keeps every analysis run, not only the latest one. The bugs table denormalizes the
-- latest summary fields for fast table rendering.
create table public.bug_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  occurrence_id uuid references public.bug_occurrences (id) on delete set null,
  import_id uuid references public.bug_imports (id) on delete set null,
  provider text,
  model text,
  prompt_version text,
  analysis jsonb not null,
  enriched_docs jsonb not null default '[]'::jsonb,
  raw_response text,
  error text,
  processing_ms integer not null default 0 check (processing_ms >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.bug_comments (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bugs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bug_events (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid references public.bugs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type public.bug_event_type not null,
  from_status public.bug_status,
  to_status public.bug_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bug_imports_project_created_idx on public.bug_imports (project_id, created_at desc);
create index bugs_project_status_idx on public.bugs (project_id, status, updated_at desc);
create index bugs_project_severity_idx on public.bugs (project_id, severity, updated_at desc);
create index bugs_project_area_idx on public.bugs (project_id, affected_area);
create index bugs_project_deleted_idx on public.bugs (project_id, deleted_at);
create index bug_occurrences_bug_idx on public.bug_occurrences (bug_id, created_at desc);
create index bug_occurrences_import_idx on public.bug_occurrences (import_id, source_row_index);
create index bug_analysis_runs_bug_idx on public.bug_analysis_runs (bug_id, created_at desc);
create index bug_comments_bug_idx on public.bug_comments (bug_id, created_at);
create index bug_events_bug_idx on public.bug_events (bug_id, created_at desc);
create index bug_events_project_idx on public.bug_events (project_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger bugs_set_updated_at
before update on public.bugs
for each row execute function public.set_updated_at();

create trigger bug_comments_set_updated_at
before update on public.bug_comments
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.add_project_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger projects_add_owner_member
after insert on public.projects
for each row execute function public.add_project_owner_member();

create function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project_id
      and user_id = auth.uid()
  );
$$;

create function public.is_project_peer(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members current_member
    join public.project_members target_member
      on target_member.project_id = current_member.project_id
    where current_member.user_id = auth.uid()
      and target_member.user_id = target_user_id
  );
$$;

create function public.has_project_role(target_project_id uuid, allowed_roles public.project_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project_id
      and user_id = auth.uid()
      and role = any (allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.bug_imports enable row level security;
alter table public.bugs enable row level security;
alter table public.bug_occurrences enable row level security;
alter table public.bug_analysis_runs enable row level security;
alter table public.bug_comments enable row level security;
alter table public.bug_events enable row level security;

create policy "profiles select own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "profiles select project peers"
on public.profiles for select
to authenticated
using (public.is_project_peer(id));

create policy "profiles insert own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles update own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "projects select members"
on public.projects for select
to authenticated
using (public.is_project_member(id));

create policy "projects insert owner"
on public.projects for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "projects update admins"
on public.projects for update
to authenticated
using (public.has_project_role(id, array['owner', 'admin']::public.project_role[]))
with check (public.has_project_role(id, array['owner', 'admin']::public.project_role[]));

create policy "projects delete owners"
on public.projects for delete
to authenticated
using (public.has_project_role(id, array['owner']::public.project_role[]));

create policy "project members select members"
on public.project_members for select
to authenticated
using (public.is_project_member(project_id));

create policy "project members insert admins"
on public.project_members for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'admin']::public.project_role[]));

create policy "project members update admins"
on public.project_members for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'admin']::public.project_role[]))
with check (public.has_project_role(project_id, array['owner', 'admin']::public.project_role[]));

create policy "project members delete admins"
on public.project_members for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'admin']::public.project_role[]));

create policy "bug imports select members"
on public.bug_imports for select
to authenticated
using (public.is_project_member(project_id));

create policy "bug imports insert editors"
on public.bug_imports for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

create policy "bugs select members"
on public.bugs for select
to authenticated
using (public.is_project_member(project_id));

create policy "bugs insert editors"
on public.bugs for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

create policy "bugs update editors"
on public.bugs for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]))
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

create policy "bugs delete admins"
on public.bugs for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'admin']::public.project_role[]));

create policy "bug occurrences select members"
on public.bug_occurrences for select
to authenticated
using (public.is_project_member(project_id));

create policy "bug occurrences insert editors"
on public.bug_occurrences for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

create policy "analysis runs select members"
on public.bug_analysis_runs for select
to authenticated
using (public.is_project_member(project_id));

create policy "analysis runs insert editors"
on public.bug_analysis_runs for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

create policy "comments select members"
on public.bug_comments for select
to authenticated
using (public.is_project_member(project_id));

create policy "comments insert members"
on public.bug_comments for insert
to authenticated
with check (public.is_project_member(project_id) and auth.uid() = created_by);

create policy "comments update own or admins"
on public.bug_comments for update
to authenticated
using (
  auth.uid() = created_by
  or public.has_project_role(project_id, array['owner', 'admin']::public.project_role[])
)
with check (
  auth.uid() = created_by
  or public.has_project_role(project_id, array['owner', 'admin']::public.project_role[])
);

create policy "comments delete own or admins"
on public.bug_comments for delete
to authenticated
using (
  auth.uid() = created_by
  or public.has_project_role(project_id, array['owner', 'admin']::public.project_role[])
);

create policy "events select members"
on public.bug_events for select
to authenticated
using (public.is_project_member(project_id));

create policy "events insert members"
on public.bug_events for insert
to authenticated
with check (public.is_project_member(project_id) and auth.uid() = actor_id);
