-- ═══════════════════════════════════════════════════════════════════════
-- AQYL — схема облачной синхронизации.
--
-- Выполнить целиком в Supabase → SQL Editor → New query → Run.
-- Скрипт идемпотентный: повторный запуск ничего не сломает.
--
-- Что здесь есть и чего сознательно нет.
--
-- Профиль хранится одним полем jsonb, а не разложенным по таблицам. Причина
-- практическая: источник правды у нас — localStorage на устройстве, схема
-- там меняется каждую неделю, и вести параллельную миграцию в Postgres
-- значило бы удваивать работу без единой выгоды, пока по этим данным нет
-- аналитики. Когда аналитика понадобится, jsonb разбирается запросом.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  email       text,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Обязательна. Без неё anon-ключ, который лежит в браузере у каждого
-- посетителя, открывает чтение и запись всей таблицы: любой ученик увидел бы
-- прогресс любого другого. Ключ публичен по устройству Supabase, и именно
-- эти политики — единственное, что стоит между ним и чужими данными.

alter table public.profiles enable row level security;

drop policy if exists "profiles: владелец читает своё"    on public.profiles;
drop policy if exists "profiles: владелец создаёт своё"   on public.profiles;
drop policy if exists "profiles: владелец обновляет своё" on public.profiles;

create policy "profiles: владелец читает своё"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: владелец создаёт своё"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: владелец обновляет своё"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Политики delete нет намеренно: удаление профиля должно идти через
-- удаление аккаунта (on delete cascade выше), а не одним запросом из
-- браузера, который легко послать случайно.

-- ── Служебное ─────────────────────────────────────────────────────────────

create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at desc);

-- updated_at проставляет клиент, но на него нельзя полагаться: часы на
-- телефоне ученика могут отставать на месяцы, а слияние прогресса сравнивает
-- в том числе и эту метку. Триггер делает значение серверным.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before insert or update on public.profiles
  for each row execute function public.touch_updated_at();
