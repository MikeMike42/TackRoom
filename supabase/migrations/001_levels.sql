-- Rename rider level "novice" → "advanced_beginner".
-- Run in the SQL Editor if you created the database before this change.

update public.clients   set rider_level = 'advanced_beginner' where rider_level = 'novice';
update public.offerings set level       = 'advanced_beginner' where level = 'novice';
update public.homework  set level       = 'advanced_beginner' where level = 'novice';

alter table public.clients   drop constraint if exists clients_rider_level_check;
alter table public.clients   add  constraint clients_rider_level_check
  check (rider_level in ('beginner','advanced_beginner','intermediate','advanced'));

alter table public.offerings drop constraint if exists offerings_level_check;
alter table public.offerings add  constraint offerings_level_check
  check (level in ('beginner','advanced_beginner','intermediate','advanced','all'));

alter table public.homework  drop constraint if exists homework_level_check;
alter table public.homework  add  constraint homework_level_check
  check (level in ('beginner','advanced_beginner','intermediate','advanced','all'));
