-- ============================================================
--  Nice2Meetya! — Supabase Schema
--  Run this in your Supabase project → SQL Editor → Run
-- ============================================================

-- EVENTS table
-- One row per event night. Only one row has active = true at a time.
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  edition         text not null default 'Edition VI',
  active          boolean not null default false,
  guest_code      text not null default 'N2MY',
  host_code       text not null default 'HOST24',
  current_phase   int not null default 0,
  current_round   int not null default 1,
  current_prompt  text not null default '',
  table_count     int not null default 6,
  created_at      timestamptz default now()
);

-- GUESTS table
-- One row per guest per event.
create table if not exists guests (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  name            text not null,
  round1_table    int not null default 1,
  round2_table    int not null default 1,
  round3_table    int not null default 1,
  created_at      timestamptz default now()
);

-- Index for fast guest lookup by event
create index if not exists guests_event_id_idx on guests(event_id);

-- ============================================================
--  Enable Realtime on the events table
--  (guests table changes are handled via polling in the app)
-- ============================================================
alter publication supabase_realtime add table events;

-- ============================================================
--  Row Level Security
--  The anon key can read events and guests (for guest view).
--  Writes are also allowed via anon key — the host code
--  acts as the application-level password.
-- ============================================================
alter table events enable row level security;
alter table guests enable row level security;

-- Allow anon to read active events (for gate check + guest view)
create policy "Public read active events"
  on events for select
  using (active = true);

-- Allow anon to update active events (host pushes phase/prompt)
create policy "Public update active events"
  on events for update
  using (active = true);

-- Allow anon to read guests of active events
create policy "Public read guests"
  on guests for select
  using (
    exists (
      select 1 from events e
      where e.id = guests.event_id and e.active = true
    )
  );

-- Allow anon to insert/update/delete guests of active events
create policy "Public write guests"
  on guests for insert
  with check (
    exists (
      select 1 from events e
      where e.id = event_id and e.active = true
    )
  );

create policy "Public update guests"
  on guests for update
  using (
    exists (
      select 1 from events e
      where e.id = guests.event_id and e.active = true
    )
  );

create policy "Public delete guests"
  on guests for delete
  using (
    exists (
      select 1 from events e
      where e.id = guests.event_id and e.active = true
    )
  );

-- ============================================================
--  Seed your first event
--  Run this separately each time you start a new event night.
--  Change the guest_code and host_code to whatever you want.
-- ============================================================

-- First deactivate any existing active event
-- update events set active = false;

-- Then insert tonight's event:
-- insert into events (edition, active, guest_code, host_code, table_count)
-- values ('Edition VI', true, 'N2MY', 'HOST24', 6);
