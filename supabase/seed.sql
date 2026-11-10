-- Nook demo data: one household, the sample apartment, chores, categories and a shopping list.

-- Members are linked in README step 4, after you create the three auth users.

insert into households (id, name) values ('00000000-0000-4000-8000-000000000001', 'Our place');

insert into plans (household_id, data) values ('00000000-0000-4000-8000-000000000001', '{"width":120,"height":80,"outline":[[0,0],[120,0],[120,80],[0,80]],"rooms":[{"id":"living","name":"Living room","floor":"wood","points":[[0,0],[58,0],[58,30],[44,30],[44,45],[0,45]],"labelAt":[36,37]},{"id":"kitchen","name":"Kitchen","floor":"tile","x":58,"y":0,"w":32,"h":25,"labelAt":[74,16]},{"id":"bath","name":"Bathroom","floor":"tile","x":90,"y":0,"w":30,"h":25,"labelAt":[109,13]},{"id":"hall","name":"Hall","floor":"wood","points":[[58,25],[90,25],[90,45],[44,45],[44,30],[58,30]],"labelAt":[76,39]},{"id":"laundry","name":"Laundry","floor":"tile","x":90,"y":25,"w":30,"h":20,"labelAt":[108,41]},{"id":"balcony","name":"Balcony","floor":"concrete","x":0,"y":45,"w":25,"h":35,"labelAt":[14,66]},{"id":"master","name":"Master bedroom","floor":"carpet","x":25,"y":45,"w":50,"h":35,"labelAt":[63,71]},{"id":"office","name":"Office","floor":"wood","x":75,"y":45,"w":45,"h":35,"labelAt":[97,63]}],"items":[{"id":"sofa","kind":"sofa","x":5,"y":4,"w":28,"h":9},{"id":"rug","kind":"rug","x":7,"y":15,"w":24,"h":15,"name":"Living room rug"},{"id":"coffee-table","kind":"table","x":12,"y":18,"w":14,"h":8},{"id":"tv","kind":"tv","x":8,"y":40,"w":22,"h":4},{"id":"armchair","kind":"armchair","x":36,"y":4},{"id":"dining","kind":"roundtable","x":40,"y":15,"w":11,"h":11},{"id":"monstera","kind":"plant","x":50.5,"y":1.5,"w":6.5,"h":6.5,"name":"Monstera"},{"id":"counter","kind":"counter","x":58,"y":0,"w":24,"h":6},{"id":"stove","kind":"stove","x":60,"y":0,"w":7,"h":6},{"id":"ksink","kind":"sink","x":68.5,"y":0,"w":8,"h":6},{"id":"coffee","kind":"coffee","x":78,"y":1,"w":3.5,"h":4,"name":"Coffee machine"},{"id":"fridge","kind":"fridge","x":83,"y":0,"w":7,"h":7.5},{"id":"dishwasher","kind":"dishwasher","x":58.5,"y":7,"w":6,"h":6},{"id":"tub","kind":"tub","x":101.5,"y":1,"w":17.5,"h":7.5},{"id":"toilet","kind":"toilet","x":93.5,"y":1,"w":5,"h":8},{"id":"bsink","kind":"sink","x":92,"y":15,"w":8,"h":6},{"id":"washer","kind":"washer","x":92,"y":27},{"id":"dryer","kind":"dryer","x":99.5,"y":27},{"id":"coat-closet","kind":"closet","x":45,"y":39.5,"w":12,"h":5,"r":180,"door":"hinged","name":"Coat closet"},{"id":"master-closet","kind":"closet","x":26,"y":73,"w":20,"h":6.5,"r":180,"name":"Master closet"},{"id":"bed","kind":"bed","x":38,"y":48,"w":17,"h":21},{"id":"ns1","kind":"nightstand","x":32.5,"y":48},{"id":"ns2","kind":"nightstand","x":56,"y":48},{"id":"mplant","kind":"plant","x":26.5,"y":46.5,"w":5,"h":5},{"id":"flowers1","kind":"flowers","x":-3,"y":62,"w":12,"h":4,"r":90,"name":"Flower box"},{"id":"flowers2","kind":"flowers","x":8,"y":76,"w":15,"h":3.5,"name":"Railing planter"},{"id":"balcony-chair","kind":"chair","x":9,"y":50,"w":6,"h":6,"r":200},{"id":"desk","kind":"desk","x":100,"y":72,"w":18,"h":7},{"id":"desk-chair","kind":"chair","x":106.5,"y":66,"w":5,"h":5,"r":180},{"id":"shelf","kind":"shelf","x":93,"y":45.5,"w":16,"h":4},{"id":"pothos","kind":"plant","x":112,"y":47,"w":6,"h":6,"name":"Pothos"},{"id":"door-master","kind":"door","x":65,"y":45,"w":8,"name":"Bedroom door"},{"id":"door-office","kind":"door","x":78,"y":45,"w":8,"name":"Office door"},{"id":"door-kitchen","kind":"door","x":70,"y":25,"w":8,"name":"Kitchen door"},{"id":"living-opening","kind":"opening","x":45,"y":30,"w":12,"name":"Living room opening"},{"id":"door-laundry","kind":"door","x":90,"y":33,"w":8,"r":90,"name":"Laundry door"},{"id":"door-bath","kind":"door","x":104,"y":25,"w":8,"flip":true,"name":"Bathroom door"},{"id":"balcony-slider","kind":"slider","x":25,"y":52,"w":12,"r":90,"name":"Balcony door"},{"id":"win-living","kind":"window","x":8,"y":0,"w":22},{"id":"win-master","kind":"window","x":48,"y":80,"w":16},{"id":"win-office","kind":"window","x":120,"y":52,"w":14,"r":90},{"id":"win-bath","kind":"window","x":120,"y":10,"w":8,"r":90}]}'::jsonb);

insert into chores (household_id, title, target_id, icon, interval_days, use_limit, uses, last_done_at) values

  ('00000000-0000-4000-8000-000000000001', 'Clear out leftovers', 'fridge', 'alert', 7, null, 0, now() - interval '360 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Wipe fridge shelves', 'fridge', 'sparkle', 30, null, 0, now() - interval '744 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Vacuum carpet', 'master', 'sparkle', 7, null, 0, now() - interval '276.0 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Water flower box', 'flowers1', 'drop', 3, null, 0, now() - interval '108.0 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Mop floor', 'kitchen', 'sparkle', 7, null, 0, now() - interval '172.8 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Wipe down stove', 'stove', 'sparkle', null, 1, 1, now() - interval '24 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Change sheets', 'bed', 'sparkle', 7, null, 0, now() - interval '175.2 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Water monstera', 'monstera', 'drop', 7, null, 0, now() - interval '170.4 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Descale coffee machine', 'coffee', 'wrench', 60, 30, 26, now() - interval '480 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Clean washer filter', 'washer', 'wrench', null, 20, 17, now() - interval '960 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Reorganize master closet', 'master-closet', 'folder', 90, null, 0, now() - interval '2112 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Scrub tub', 'bath', 'sparkle', 14, null, 0, now() - interval '300.0 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Vacuum rug', 'rug', 'sparkle', 7, null, 0, now() - interval '144 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Water pothos', 'pothos', 'drop', 10, null, 0, now() - interval '204.0 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Vacuum living room', 'living', 'sparkle', 7, null, 0, now() - interval '48 hours');

insert into task_categories (id, household_id, name, icon, sort) values ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Home admin', 'folder', 0);

insert into tasks (household_id, category_id, title, due_on) values
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Renew renters insurance', current_date - 2),
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Book chimney sweep', null),
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Pay council tax', current_date + 4);

insert into task_categories (id, household_id, name, icon, sort) values ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Lisbon trip', 'tag', 1);

insert into tasks (household_id, category_id, title, due_on) values
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Book the hotel', current_date + 4),
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Ask Ana about the cat', null),
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Renew passport', current_date + 9);

insert into task_categories (id, household_id, name, icon, sort) values ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Balcony garden', 'leaf', 2);

insert into tasks (household_id, category_id, title, due_on) values
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Repot the herbs', null),
  ('00000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Buy compost', null);

insert into shopping_items (household_id, name, qty) values
  ('00000000-0000-4000-8000-000000000001', 'Oat milk', 2),
  ('00000000-0000-4000-8000-000000000001', 'Eggs', 1),
  ('00000000-0000-4000-8000-000000000001', 'Basil plant', 1),
  ('00000000-0000-4000-8000-000000000001', 'Dish soap', 1),
  ('00000000-0000-4000-8000-000000000001', 'Lemons', 4);

insert into shopping_items (household_id, name, bought_at, cleared_at, created_at)
  select '00000000-0000-4000-8000-000000000001', n, now() - (d || ' days')::interval, now() - (d || ' days')::interval, now() - (d || ' days')::interval
  from unnest(array['Bread', 'Bananas', 'Yoghurt', 'Pasta', 'Tomatoes', 'Cheese', 'Oat milk']) n, generate_series(3, 60, 14) d;
