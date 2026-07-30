-- Esquema para el rediseño: varios responsables por bug, fecha límite, hilos de
-- comentarios y voto.
--
-- Este archivo SOLO agrega estructura. El valor nuevo del enum no se usa acá a
-- propósito: Postgres no permite usar un valor de enum en la misma transacción en
-- que se agrega. Las funciones que lo consumen viven en 0011.

alter type public.bug_event_type add value if not exists 'due_date_changed';
alter type public.bug_event_type add value if not exists 'unassigned';
alter type public.bug_event_type add value if not exists 'voted';

-- ── Fecha límite ────────────────────────────────────────────────────────────
-- `date` y no `timestamptz`: es un compromiso de equipo ("para el 12 de junio"),
-- no un instante. Con timestamptz el mismo día se vería distinto según la zona.
alter table public.bugs add column if not exists due_date date;

create index if not exists bugs_project_due_idx
  on public.bugs (project_id, due_date)
  where due_date is not null;

-- ── Responsables ────────────────────────────────────────────────────────────
-- Tabla aparte y no una columna: un bug puede tener varios responsables. La
-- columna `bugs.assigned_to` del esquema original queda para no romper lo que ya
-- la lee, pero la fuente de verdad pasa a ser esta tabla.
create table if not exists public.bug_assignees (
  bug_id uuid not null references public.bugs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (bug_id, user_id)
);

create index if not exists bug_assignees_project_user_idx
  on public.bug_assignees (project_id, user_id);

-- ── Hilos de comentarios ────────────────────────────────────────────────────
-- Una respuesta cuelga de su comentario padre. `on delete cascade`: si se borra
-- el comentario raíz, el hilo entero se va con él (no quedan respuestas huérfanas
-- sin contexto).
alter table public.bug_comments
  add column if not exists parent_id uuid references public.bug_comments (id) on delete cascade;

create index if not exists bug_comments_parent_idx
  on public.bug_comments (parent_id, created_at);

-- ── Voto de comentarios ─────────────────────────────────────────────────────
-- Un voto por persona y por comentario: cambiar de opinión actualiza la fila, no
-- agrega otra. `value` es -1 o 1, así el total sale de un sum().
create table if not exists public.bug_comment_votes (
  comment_id uuid not null references public.bug_comments (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists bug_comment_votes_comment_idx
  on public.bug_comment_votes (comment_id);

drop trigger if exists bug_comment_votes_set_updated_at on public.bug_comment_votes;
create trigger bug_comment_votes_set_updated_at
before update on public.bug_comment_votes
for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.bug_assignees enable row level security;
alter table public.bug_comment_votes enable row level security;

drop policy if exists "bug assignees select members" on public.bug_assignees;
create policy "bug assignees select members"
on public.bug_assignees for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "bug assignees write editors" on public.bug_assignees;
create policy "bug assignees write editors"
on public.bug_assignees for all
to authenticated
using (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]))
with check (public.has_project_role(project_id, array['owner', 'admin', 'editor']::public.project_role[]));

drop policy if exists "comment votes select members" on public.bug_comment_votes;
create policy "comment votes select members"
on public.bug_comment_votes for select
to authenticated
using (public.is_project_member(project_id));

-- Votar es de cualquier miembro (incluido `viewer`), pero solo sobre su propio
-- voto: nadie puede escribir el voto de otro.
drop policy if exists "comment votes write own" on public.bug_comment_votes;
create policy "comment votes write own"
on public.bug_comment_votes for all
to authenticated
using (public.is_project_member(project_id) and auth.uid() = user_id)
with check (public.is_project_member(project_id) and auth.uid() = user_id);
