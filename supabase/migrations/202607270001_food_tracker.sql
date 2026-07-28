begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  time_zone text not null default 'America/Toronto',
  daily_targets jsonb not null default '{
    "calories": 0,
    "protein": 0,
    "carbohydrates": 0,
    "sugar": 0,
    "fat": 0,
    "fibre": 0
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  constraint profiles_daily_targets_object check (jsonb_typeof(daily_targets) = 'object')
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  consumed_at timestamptz not null,
  notes text not null default '',
  known_ingredients text not null default '',
  image_path text,
  image_retention text not null check (image_retention in ('retain', 'delete_after_analysis')),
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'complete', 'failed')),
  ai_provider text,
  ai_model text,
  analysis_schema_version text,
  overall_confidence numeric(4, 3)
    check (overall_confidence is null or overall_confidence between 0 and 1),
  raw_analysis jsonb,
  reference_object jsonb not null default '{"type":"none"}'::jsonb,
  follow_up_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_name_length check (char_length(name) between 1 and 100),
  constraint meals_notes_length check (char_length(notes) <= 1000),
  constraint meals_known_ingredients_length check (char_length(known_ingredients) <= 1000),
  constraint meals_user_request_unique unique (user_id, client_request_id)
);

create index if not exists meals_user_consumed_idx
  on public.meals (user_id, consumed_at desc);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  ai_temporary_id text not null,
  ai_detected_name text not null,
  user_confirmed_name text not null,
  ai_estimated_weight_grams numeric(9, 2) not null check (ai_estimated_weight_grams > 0),
  user_confirmed_weight_grams numeric(9, 2) not null check (user_confirmed_weight_grams > 0),
  minimum_weight_grams numeric(9, 2) not null check (minimum_weight_grams > 0),
  maximum_weight_grams numeric(9, 2) not null check (maximum_weight_grams > 0),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  nutrition_source text not null check (nutrition_source in ('usda', 'manual', 'mock')),
  nutrition_source_record_id text,
  nutrition_match jsonb,
  original_nutrients jsonb not null,
  confirmed_nutrients jsonb not null,
  user_state text not null check (user_state in ('detected', 'edited', 'confirmed', 'added')),
  nutrient_override boolean not null default false,
  assumptions jsonb not null default '[]'::jsonb,
  uncertainty_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_items_name_lengths check (
    char_length(ai_detected_name) between 1 and 160
    and char_length(user_confirmed_name) between 1 and 160
  ),
  constraint meal_items_weight_range check (
    minimum_weight_grams <= maximum_weight_grams
  ),
  constraint meal_items_meal_temporary_unique unique (meal_id, ai_temporary_id)
);

create index if not exists meal_items_meal_idx on public.meal_items (meal_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists meals_set_updated_at on public.meals;
create trigger meals_set_updated_at
before update on public.meals
for each row execute function public.set_updated_at();

drop trigger if exists meal_items_set_updated_at on public.meal_items;
create trigger meal_items_set_updated_at
before update on public.meal_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own"
on public.meals for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own"
on public.meals for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "meals_update_own" on public.meals;
create policy "meals_update_own"
on public.meals for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own"
on public.meals for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "meal_items_select_own" on public.meal_items;
create policy "meal_items_select_own"
on public.meal_items for select
to authenticated
using (
  exists (
    select 1 from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
  )
);

drop policy if exists "meal_items_insert_own" on public.meal_items;
create policy "meal_items_insert_own"
on public.meal_items for insert
to authenticated
with check (
  exists (
    select 1 from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
  )
);

drop policy if exists "meal_items_update_own" on public.meal_items;
create policy "meal_items_update_own"
on public.meal_items for update
to authenticated
using (
  exists (
    select 1 from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
  )
);

drop policy if exists "meal_items_delete_own" on public.meal_items;
create policy "meal_items_delete_own"
on public.meal_items for delete
to authenticated
using (
  exists (
    select 1 from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-images',
  'meal-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal_images_select_own" on storage.objects;
create policy "meal_images_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "meal_images_insert_own" on storage.objects;
create policy "meal_images_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "meal_images_update_own" on storage.objects;
create policy "meal_images_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "meal_images_delete_own" on storage.objects;
create policy "meal_images_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
