-- ============================================================
--  DUMMY DATA — for testing only. Replace with the real list.
--  Every row below is a placeholder (names, numbers, dishes, prices).
-- ============================================================

insert into reg_editions (slug, title, theme, line, date_label, venue_label, guest_fee_kobo, guests_per_alumnus)
values ('ix', 'Edition IX', 'Momentum',
        'Moving is not the same as going somewhere.',
        'Sunday, 27 December · 5pm',          -- PLACEHOLDER
        'Venue details to follow',      -- PLACEHOLDER
        1000000, 2)
on conflict (slug) do nothing;

insert into alumni (name, phone) values
  ('Tolu Adeyemi',     '2348010000001'),
  ('Kemi Balogun',     '2348010000002'),
  ('Chidi Okafor',     '2348010000003'),
  ('Ifeoma Nwosu',     '2348010000004'),
  ('Seun Lawal',       '2348010000005'),
  ('Amaka Eze',        '2348010000006')
on conflict (phone) do nothing;

-- Placeholder menu (prices in kobo: ₦1 = 100 kobo)
insert into reg_menu_items (edition_id, category, name, description, price_kobo, sort)
select e.id, m.category, m.name, m.description, m.price_kobo, m.sort
from reg_editions e,
(values
  ('Mains',  'Grilled chicken & smoky jollof', 'Quarter chicken, plantain',      1200000, 1),
  ('Mains',  'Seafood pasta',                  'Prawns, calamari, light cream',   1500000, 2),
  ('Mains',  'Beef suya platter',              'Yaji, onions, fries',             1100000, 3),
  ('Mains',  'Vegetable stir-fry rice',        'Seasonal greens, sesame',          900000, 4),
  ('Drinks', 'Mocktail',                       'House blend',                      450000, 10),
  ('Drinks', 'Chapman',                        '',                                 400000, 11),
  ('Drinks', 'Bottled water',                  '',                                 150000, 12)
) as m(category, name, description, price_kobo, sort)
where e.slug = 'ix'
  and not exists (select 1 from reg_menu_items where edition_id = e.id);
