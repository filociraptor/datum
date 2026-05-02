-- ============================================================
-- Datum — initial schema
-- ============================================================

-- contacts must be created before projects (FK reference)
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  initials    text,
  created_at  timestamptz default now() not null
);

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  client      text,
  meta        jsonb default '{}'::jsonb,
  contact_id  uuid references contacts(id) on delete set null,
  created_at  timestamptz default now() not null
);

create table if not exists project_links (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade not null,
  label        text not null,
  kind         text not null default 'url'
                 check (kind in ('url', 'pdf', 'dwg', 'spec', 'permit', 'other')),
  url          text not null,
  sort_order   integer not null default 0
);

create table if not exists tasks (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references auth.users(id) on delete cascade not null,
  project_id              uuid references projects(id) on delete cascade,
  title                   text not null,
  notes                   text,
  due_date                date,
  plan_for                date,
  estimate_minutes        integer,
  bump_count              integer not null default 0,
  waiting_on_contact_id   uuid references contacts(id) on delete set null,
  nudge_on                date,
  done                    boolean not null default false,
  created_at              timestamptz default now() not null
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists contacts_user_id_idx      on contacts(user_id);
create index if not exists projects_user_id_idx      on projects(user_id);
create index if not exists project_links_project_idx on project_links(project_id, sort_order);
create index if not exists tasks_user_id_idx         on tasks(user_id);
create index if not exists tasks_project_id_idx      on tasks(project_id);
create index if not exists tasks_due_date_idx        on tasks(due_date) where done = false;
create index if not exists tasks_plan_for_idx        on tasks(plan_for) where done = false;

-- ============================================================
-- Row-level security
-- ============================================================
alter table contacts      enable row level security;
alter table projects      enable row level security;
alter table project_links enable row level security;
alter table tasks         enable row level security;

-- contacts
create policy "contacts_select" on contacts
  for select using (auth.uid() = user_id);
create policy "contacts_insert" on contacts
  for insert with check (auth.uid() = user_id);
create policy "contacts_update" on contacts
  for update using (auth.uid() = user_id);
create policy "contacts_delete" on contacts
  for delete using (auth.uid() = user_id);

-- projects
create policy "projects_select" on projects
  for select using (auth.uid() = user_id);
create policy "projects_insert" on projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update" on projects
  for update using (auth.uid() = user_id);
create policy "projects_delete" on projects
  for delete using (auth.uid() = user_id);

-- project_links — access derived from project ownership
create policy "project_links_select" on project_links
  for select using (
    exists (
      select 1 from projects
      where id = project_links.project_id
        and user_id = auth.uid()
    )
  );
create policy "project_links_insert" on project_links
  for insert with check (
    exists (
      select 1 from projects
      where id = project_links.project_id
        and user_id = auth.uid()
    )
  );
create policy "project_links_update" on project_links
  for update using (
    exists (
      select 1 from projects
      where id = project_links.project_id
        and user_id = auth.uid()
    )
  );
create policy "project_links_delete" on project_links
  for delete using (
    exists (
      select 1 from projects
      where id = project_links.project_id
        and user_id = auth.uid()
    )
  );

-- tasks
create policy "tasks_select" on tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert" on tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update" on tasks
  for update using (auth.uid() = user_id);
create policy "tasks_delete" on tasks
  for delete using (auth.uid() = user_id);
