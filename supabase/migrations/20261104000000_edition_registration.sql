-- ============================================================
--  Nice2Meetya! — Invitation-only registration
--  Tables are fully closed to the browser (RLS on, no policies).
--  Every read/write goes through Edge Functions using the
--  service role, so phone numbers and payments never leak.
-- ============================================================

-- One row per edition that takes registrations
create table if not exists reg_editions (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,              -- 'ix'
  title              text not null,                     -- 'Edition IX'
  theme              text not null default '',          -- 'Momentum'
  line               text not null default '',          -- teaser line
  date_label         text not null default '',          -- 'Sunday, 27 December · 5pm'
  venue_label        text not null default '',          -- shown only after payment
  guest_fee_kobo     int  not null default 1000000,     -- ₦10,000
  guests_per_alumnus int  not null default 2,
  is_open            boolean not null default true,
  orders_close_at    timestamptz,                       -- food cutoff
  created_at         timestamptz not null default now()
);

-- Everyone who has ever attended. Phone stored normalised: 234XXXXXXXXXX
create table if not exists alumni (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null unique,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Who you have personally invited to a given edition
create table if not exists reg_invites (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references reg_editions(id) on delete cascade,
  alumni_id    uuid not null references alumni(id) on delete cascade,
  token        text not null unique,   -- alumnus' own link
  guest_token  text not null unique,   -- link they share with their guests
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (edition_id, alumni_id)
);

create table if not exists reg_menu_items (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references reg_editions(id) on delete cascade,
  category     text not null default 'Mains',
  name         text not null,
  description  text not null default '',
  price_kobo   int  not null check (price_kobo >= 0),
  active       boolean not null default true,
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists reg_registrations (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references reg_editions(id) on delete cascade,
  invite_id    uuid not null references reg_invites(id) on delete cascade,
  kind         text not null check (kind in ('alumni','guest')),
  name         text not null,
  phone        text not null,
  email        text not null,
  about        text not null default '',
  entry_kobo   int  not null default 0,
  food_kobo    int  not null default 0,
  total_kobo   int  not null,
  status       text not null default 'pending' check (status in ('pending','paid','cancelled')),
  reference    text not null unique,
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists reg_registrations_invite_idx on reg_registrations(invite_id, kind, status);
create index if not exists reg_registrations_edition_idx on reg_registrations(edition_id, status);
-- One confirmed seat per phone per edition
create unique index if not exists reg_one_paid_seat_per_phone
  on reg_registrations(edition_id, phone) where status = 'paid';

create table if not exists reg_order_items (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references reg_registrations(id) on delete cascade,
  menu_item_id     uuid references reg_menu_items(id) on delete set null,
  name             text not null,       -- snapshot at time of order
  qty              int  not null check (qty > 0),
  unit_kobo        int  not null
);
create index if not exists reg_order_items_reg_idx on reg_order_items(registration_id);

-- Lock everything: RLS on and no policies = no browser access at all.
alter table reg_editions      enable row level security;
alter table alumni            enable row level security;
alter table reg_invites       enable row level security;
alter table reg_menu_items    enable row level security;
alter table reg_registrations enable row level security;
alter table reg_order_items   enable row level security;

revoke all on reg_editions, alumni, reg_invites, reg_menu_items,
              reg_registrations, reg_order_items from anon, authenticated;
