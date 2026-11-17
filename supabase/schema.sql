-- FinanzAI — schema Supabase completo: account, dati personali, wallet condivisi, carte fedeltà,
-- preferenze, notifiche push, codice di recupero password e telemetria.
-- Rieseguibile: crea solo ciò che manca e ridefinisce funzioni e regole, senza cancellare dati.
-- Applicazione: node scripts/apply-schema.mjs (Management API) oppure SQL Editor → incolla → Run.

create extension if not exists pgcrypto with schema extensions;

-- ═════════════════════════════════════════════════════════════════════════════
-- TABELLE
-- ═════════════════════════════════════════════════════════════════════════════

-- Profilo pubblico verso gli altri membri dei wallet (solo il nome scelto, mai l'email).
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at   timestamptz not null default now()
);

-- Dati personali (movimenti, budget, obiettivi, categorie, carte fedeltà private): un documento per utente.
-- "version" serve al salvataggio concorrente da più dispositivi (optimistic locking + unione a tre vie nell'app).
create table if not exists public.personal_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  version    integer     not null default 0,
  updated_at timestamptz not null default now(),
  constraint personal_data_size check (pg_column_size(data) < 4000000)
);

-- Wallet condiviso (spese di gruppo + carte fedeltà condivise). "data" = { expenses: [], loyaltyCards: [] }.
create table if not exists public.wallets (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 60),
  currency    text        not null default 'EUR' check (char_length(currency) = 3),
  emoji       text        not null default '👛' check (char_length(emoji) <= 8),
  invite_code text        not null unique,
  data        jsonb       not null default '{}'::jsonb,
  version     integer     not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint wallets_data_size check (pg_column_size(data) < 4000000)
);

-- Membri dei wallet (un utente può far parte di più wallet).
create table if not exists public.wallet_members (
  wallet_id    uuid not null references public.wallets (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (wallet_id, user_id)
);
create index if not exists wallet_members_user_idx on public.wallet_members (user_id);

-- Preferenze personali (tema, valuta, notifiche, orario e fuso orario): mai condivise.
create table if not exists public.user_settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prefs           jsonb not null default '{}'::jsonb check (pg_column_size(prefs) < 20000),
  timezone        text  not null default 'Europe/Rome' check (char_length(timezone) <= 64),
  last_daily_push date,
  updated_at      timestamptz not null default now()
);

-- Iscrizioni Web Push (browser / iPhone con app nella schermata Home).
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- FUNZIONI DI SUPPORTO
-- ═════════════════════════════════════════════════════════════════════════════

-- Codice casuale leggibile (niente 0/O/1/I).
create or replace function public.gen_code(p_len integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  code text := '';
begin
  for i in 0..p_len - 1 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

create or replace function public.normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$ select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); $$;

-- True se l'utente corrente è membro del wallet (security definer: evita la ricorsione delle RLS).
create or replace function public.is_wallet_member(p_wallet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.wallet_members
                 where wallet_id = p_wallet_id and user_id = (select auth.uid()));
$$;

create or replace function public.wallets_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists wallets_touch on public.wallets;
create trigger wallets_touch before update on public.wallets
  for each row execute function public.wallets_touch();

create or replace function public.personal_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists personal_touch on public.personal_data;
create trigger personal_touch before update on public.personal_data
  for each row execute function public.personal_touch();

-- ═════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY: ogni utente vede solo i propri dati e i wallet di cui è membro
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.profiles           enable row level security;
alter table public.personal_data      enable row level security;
alter table public.wallets            enable row level security;
alter table public.wallet_members     enable row level security;
alter table public.user_settings      enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists personal_own on public.personal_data;
create policy personal_own on public.personal_data for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists wallets_select_member on public.wallets;
drop policy if exists wallets_update_member on public.wallets;
create policy wallets_select_member on public.wallets for select to authenticated
  using (public.is_wallet_member(id));
create policy wallets_update_member on public.wallets for update to authenticated
  using (public.is_wallet_member(id)) with check (public.is_wallet_member(id));

drop policy if exists members_select_same_wallet on public.wallet_members;
drop policy if exists members_update_self on public.wallet_members;
create policy members_select_same_wallet on public.wallet_members for select to authenticated
  using (public.is_wallet_member(wallet_id));
create policy members_update_self on public.wallet_members for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists settings_own on public.user_settings;
create policy settings_own on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Privilegi per colonna: i membri cambiano solo contenuto e nome del wallet (non codice invito, id, autore).
revoke all on public.profiles, public.personal_data, public.wallets, public.wallet_members,
              public.user_settings, public.push_subscriptions from anon;
revoke insert, update, delete on public.wallets from authenticated;
grant select on public.wallets to authenticated;
grant update (data, version, name, emoji, currency) on public.wallets to authenticated;
revoke insert, update, delete on public.wallet_members from authenticated;
grant select on public.wallet_members to authenticated;
grant update (display_name) on public.wallet_members to authenticated;
grant select, insert, update, delete on public.profiles, public.personal_data,
      public.user_settings, public.push_subscriptions to authenticated;
revoke update (last_daily_push) on public.user_settings from authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- FUNZIONI CHIAMATE DALL'APP
-- ═════════════════════════════════════════════════════════════════════════════

-- Crea un wallet condiviso; chi lo crea ne è proprietario.
create or replace function public.create_wallet(p_name text, p_currency text default 'EUR',
                                                p_emoji text default '👛', p_display_name text default '')
returns table (wallet_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  wid uuid;
  code text := public.gen_code(8);
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from public.wallet_members m where m.user_id = me) >= 20 then
    raise exception 'too_many_wallets';
  end if;
  insert into public.wallets (name, currency, emoji, invite_code, data)
    values (left(trim(p_name), 60), upper(left(coalesce(p_currency, 'EUR'), 3)), left(coalesce(p_emoji, '👛'), 8), code,
            '{"expenses": [], "loyaltyCards": []}'::jsonb)
    returning id into wid;
  insert into public.wallet_members (wallet_id, user_id, display_name, role)
    values (wid, me, left(coalesce(p_display_name, ''), 40), 'owner');
  return query select wid, code;
end $$;

-- Entra in un wallet con il codice invito.
create or replace function public.join_wallet(p_code text, p_display_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into target from public.wallets where invite_code = public.normalize_code(p_code);
  if target is null then raise exception 'invalid_invite_code'; end if;
  if (select count(*) from public.wallet_members where wallet_id = target) >= 30 then
    raise exception 'wallet_full';
  end if;
  insert into public.wallet_members (wallet_id, user_id, display_name, role)
    values (target, me, left(coalesce(p_display_name, ''), 40), 'member')
    on conflict (wallet_id, user_id) do nothing;
  return target;
end $$;

-- Esce da un wallet. Se era l'ultimo membro il wallet viene eliminato; se era il proprietario
-- la proprietà passa al membro più anziano.
create or replace function public.leave_wallet(p_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  was_owner boolean;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.wallet_members where wallet_id = p_wallet_id and user_id = me
    returning role = 'owner' into was_owner;
  if not exists (select 1 from public.wallet_members where wallet_id = p_wallet_id) then
    delete from public.wallets where id = p_wallet_id;
  elsif was_owner then
    update public.wallet_members set role = 'owner'
      where (wallet_id, user_id) = (select wallet_id, user_id from public.wallet_members
                                    where wallet_id = p_wallet_id order by joined_at limit 1);
  end if;
end $$;

-- Nuovo codice invito (il vecchio smette di funzionare). Solo il proprietario.
create or replace function public.regenerate_invite_code(p_wallet_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare code text := public.gen_code(8);
begin
  if not exists (select 1 from public.wallet_members
                 where wallet_id = p_wallet_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_owner';
  end if;
  update public.wallets set invite_code = code where id = p_wallet_id;
  return code;
end $$;

-- Il proprietario toglie un membro.
create or replace function public.remove_wallet_member(p_wallet_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.wallet_members
                 where wallet_id = p_wallet_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_owner';
  end if;
  if p_user_id = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from public.wallet_members where wallet_id = p_wallet_id and user_id = p_user_id;
end $$;

-- Aggiorna il nome visibile in profilo e in tutti i wallet.
create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); n text := left(trim(coalesce(p_name, '')), 40);
begin
  if me is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles (user_id, display_name) values (me, n)
    on conflict (user_id) do update set display_name = excluded.display_name;
  update public.wallet_members set display_name = n where user_id = me;
end $$;

-- "Elimina account": esce da tutti i wallet (eliminando quelli rimasti vuoti) e cancella l'utente.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  w uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  for w in select wallet_id from public.wallet_members where user_id = me loop
    perform public.leave_wallet(w);
  end loop;
  delete from auth.users where id = me;
end $$;

revoke execute on function
  public.gen_code(integer), public.normalize_code(text), public.is_wallet_member(uuid),
  public.create_wallet(text, text, text, text), public.join_wallet(text, text), public.leave_wallet(uuid),
  public.regenerate_invite_code(uuid), public.remove_wallet_member(uuid, uuid),
  public.set_display_name(text), public.delete_my_account()
  from public, anon;
grant execute on function
  public.is_wallet_member(uuid), public.create_wallet(text, text, text, text), public.join_wallet(text, text),
  public.leave_wallet(uuid), public.regenerate_invite_code(uuid), public.remove_wallet_member(uuid, uuid),
  public.set_display_name(text), public.delete_my_account()
  to authenticated;

-- Tempo reale: aggiornamenti dei wallet e dei dati personali (rispettano le RLS).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets') then
    alter publication supabase_realtime add table public.wallets;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_data') then
    alter publication supabase_realtime add table public.personal_data;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallet_members') then
    alter publication supabase_realtime add table public.wallet_members;
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- CODICE DI RECUPERO PASSWORD (senza email)
-- Creato dall'app al primo accesso, mostrato una sola volta, salvato solo come hash bcrypt.
-- La funzione server recover-password verifica email + codice (max 5 errori/ora) e imposta la nuova password.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.recovery_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.recovery_attempts (
  id         bigserial primary key,
  email      text not null,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists recovery_attempts_email_idx on public.recovery_attempts (email, created_at);
alter table public.recovery_codes enable row level security;
alter table public.recovery_attempts enable row level security;
revoke all on public.recovery_codes, public.recovery_attempts from anon, authenticated;

create or replace function public.format_recovery_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$ select substr(p_code, 1, 4) || '-' || substr(p_code, 5, 4) || '-' || substr(p_code, 9, 4) || '-' || substr(p_code, 13, 4); $$;

create or replace function public.set_recovery_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text := public.gen_code(16);
begin
  if me is null then raise exception 'not_authenticated'; end if;
  insert into public.recovery_codes (user_id, code_hash, created_at)
    values (me, extensions.crypt(code, extensions.gen_salt('bf', 8)), now())
    on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return public.format_recovery_code(code);
end $$;

create or replace function public.recovery_code_created_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$ select created_at from public.recovery_codes where user_id = (select auth.uid()); $$;

create or replace function public.verify_recovery_code(p_email text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  em text := lower(trim(coalesce(p_email, '')));
  uid uuid;
  stored text;
  ok boolean := false;
begin
  if (select count(*) from public.recovery_attempts
      where email = em and not success and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_attempts';
  end if;
  select u.id, r.code_hash into uid, stored
    from auth.users u join public.recovery_codes r on r.user_id = u.id
    where lower(u.email) = em;
  if stored is not null then
    ok := extensions.crypt(public.normalize_code(p_code), stored) = stored;
  end if;
  insert into public.recovery_attempts (email, success) values (em, ok);
  delete from public.recovery_attempts where created_at < now() - interval '30 days';
  return case when ok then uid else null end;
end $$;

create or replace function public.rotate_recovery_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare code text := public.gen_code(16);
begin
  update public.recovery_codes
    set code_hash = extensions.crypt(code, extensions.gen_salt('bf', 8)), created_at = now()
    where user_id = p_user_id;
  return public.format_recovery_code(code);
end $$;

revoke execute on function
  public.format_recovery_code(text), public.set_recovery_code(), public.recovery_code_created_at(),
  public.verify_recovery_code(text, text), public.rotate_recovery_code(uuid)
  from public, anon, authenticated;
grant execute on function public.set_recovery_code(), public.recovery_code_created_at() to authenticated;
grant execute on function public.verify_recovery_code(text, text), public.rotate_recovery_code(uuid) to service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- TELEMETRIA (coda durevole per il bot Telegram dell'amministratore)
-- I client possono SOLO inserire; l'etichetta utente la mette il server (trigger), non il client.
-- Non contiene mai importi, descrizioni o nomi di spese/carte: solo nomi di azioni e codici tecnici.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.app_events (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  client_at    timestamptz,
  kind         text not null check (kind in ('event', 'error')),
  name         text not null check (name ~ '^[a-z0-9_]{1,60}$'),
  platform     text not null default 'web' check (platform in ('android', 'ios-app', 'ios-safari', 'web', 'server')),
  app_version  text not null default '' check (char_length(app_version) <= 20),
  user_id      uuid,
  user_label   text check (char_length(user_label) <= 120),
  device_id    text check (char_length(device_id) <= 40),
  detail       jsonb not null default '{}'::jsonb
               check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 4000),
  delivered_at timestamptz,
  resolved_at  timestamptz
);
create index if not exists app_events_pending_idx on public.app_events (id) where delivered_at is null;
create index if not exists app_events_created_idx on public.app_events (created_at);
create index if not exists app_events_device_idx  on public.app_events (device_id, created_at);
create index if not exists app_events_errors_idx  on public.app_events (created_at) where kind = 'error' and resolved_at is null;

create or replace function public.telemetry_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_label text;
begin
  new.created_at   := now();
  new.delivered_at := null;
  new.resolved_at  := null;
  if new.client_at is null or new.client_at > now() + interval '5 minutes'
     or new.client_at < now() - interval '30 days' then
    new.client_at := now();
  end if;

  -- Etichetta utente decisa dal server: nome scelto nel profilo, altrimenti la parte dell'email prima della @.
  if new.user_id is not null then
    select coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1))
      into v_label
      from auth.users u left join public.profiles p on p.user_id = u.id
      where u.id = new.user_id;
  end if;
  if v_label is not null then
    new.user_label := left(v_label, 120);
  else
    new.user_label := null;      -- il client non può suggerire nomi
  end if;

  -- Limiti contro gli abusi: le righe oltre soglia vengono scartate senza errore.
  if new.device_id is not null and (
       select count(*) from public.app_events e
       where e.device_id = new.device_id and e.created_at > now() - interval '1 minute') >= 60 then
    return null;
  end if;
  if (select count(*) from public.app_events e where e.created_at > now() - interval '1 minute') >= 600 then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists app_events_before_insert on public.app_events;
create trigger app_events_before_insert before insert on public.app_events
  for each row execute function public.telemetry_before_insert();

alter table public.app_events enable row level security;
drop policy if exists app_events_insert_auth on public.app_events;
drop policy if exists app_events_insert_anon on public.app_events;
create policy app_events_insert_auth on public.app_events
  for insert to authenticated with check ((user_id is null or user_id = auth.uid()) and platform <> 'server');
create policy app_events_insert_anon on public.app_events
  for insert to anon with check (user_id is null and platform <> 'server');

revoke all on public.app_events from anon, authenticated;
grant insert (client_at, kind, name, platform, app_version, user_id, device_id, detail)
  on public.app_events to anon, authenticated;
revoke all on sequence public.app_events_id_seq from public, anon, authenticated;
grant usage on sequence public.app_events_id_seq to anon, authenticated;
grant all on public.app_events to service_role;
grant all on sequence public.app_events_id_seq to service_role;

-- Nuovo utente registrato: evento creato dal server (non dipende dall'app), notificato dal bot.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_events (kind, name, platform, user_id, detail)
    values ('event', 'nuovo_utente', 'server', new.id, '{}'::jsonb);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- Funzioni per il bot (solo service_role).
create or replace function public.telemetry_users()
returns table (user_id uuid, label text, created_at timestamptz, last_sign_in_at timestamptz, wallets integer)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)),
         u.created_at, u.last_sign_in_at,
         (select count(*)::integer from public.wallet_members m where m.user_id = u.id)
  from auth.users u left join public.profiles p on p.user_id = u.id
  order by u.last_sign_in_at desc nulls last;
$$;

create or replace function public.telemetry_purge(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.app_events
  where delivered_at is not null
    and created_at < now() - make_interval(days => greatest(p_days, 7))
    and (kind = 'event' or resolved_at is not null);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.telemetry_users() from public, anon, authenticated;
revoke all on function public.telemetry_purge(integer) from public, anon, authenticated;
revoke all on function public.telemetry_before_insert() from public, anon, authenticated;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;
grant execute on function public.telemetry_users() to service_role;
grant execute on function public.telemetry_purge(integer) to service_role;
