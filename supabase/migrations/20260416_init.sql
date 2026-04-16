-- CRM Pipeline schema
-- Run this once against your Supabase project (SQL editor or CLI).

create extension if not exists "pgcrypto";

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  identifier text,
  is_duplicate text,
  status text,
  owner text,
  layer text,
  dirty_grade text,
  components text,
  full_address text,
  street text,
  city text,
  state text,
  zip text,
  country text,
  founding_year integer,
  territory text,
  notes text,
  contact_name text,
  contact_title text,
  email text,
  other text,
  warm_intro text,
  phone_linkedin text,
  notes2 text,
  touch_1_date date,
  touch_1_channel text,
  touch_2_date date,
  touch_2_channel text,
  touch_3_date date,
  touch_3_channel text,
  touch_4_date date,
  touch_4_channel text,
  touch_5_date date,
  touch_5_channel text,
  touch_6_date date,
  touch_6_channel text,
  linkedin_date date,
  linkedin text,
  response_date date,
  engaged_date date,
  email_count numeric,
  tp1_sent boolean,
  tp2_sent boolean,
  tp3_sent boolean,
  tp1_date date,
  tp2_date date,
  tp3_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_status_idx on public.companies (status);
create index if not exists companies_owner_idx on public.companies (owner);
create index if not exists companies_layer_idx on public.companies (layer);
create index if not exists companies_territory_idx on public.companies (territory);
create index if not exists companies_company_name_idx on public.companies using gin (to_tsvector('simple', coalesce(company_name, '')));

-- Automatically bump updated_at on write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- Row Level Security: any authenticated user can read and write.
alter table public.companies enable row level security;

drop policy if exists "authenticated read" on public.companies;
create policy "authenticated read"
  on public.companies for select
  to authenticated
  using (true);

drop policy if exists "authenticated insert" on public.companies;
create policy "authenticated insert"
  on public.companies for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated update" on public.companies;
create policy "authenticated update"
  on public.companies for update
  to authenticated
  using (true) with check (true);

drop policy if exists "authenticated delete" on public.companies;
create policy "authenticated delete"
  on public.companies for delete
  to authenticated
  using (true);

-- Read-only SQL executor exposed to the web SQL bar.
-- Rejects anything that isn't a single SELECT / WITH statement, caps rows, and
-- returns JSONB for convenient transport.
create or replace function public.run_readonly_query(
  query_text text,
  row_limit integer default 1000
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  normalized text;
  wrapped text;
  result jsonb;
begin
  if query_text is null then
    raise exception 'Empty query';
  end if;

  normalized := lower(regexp_replace(trim(query_text), ';+\s*$', ''));

  if normalized = '' then
    raise exception 'Empty query';
  end if;

  if position(';' in normalized) > 0 then
    raise exception 'Only a single statement is allowed (no semicolons in the middle of the query)';
  end if;

  if normalized !~ '^(select|with)\s' then
    raise exception 'Only SELECT / WITH queries are allowed';
  end if;

  if normalized ~* '\m(insert|update|delete|drop|alter|truncate|grant|revoke|create|vacuum|copy|reindex|comment|call|do)\M' then
    raise exception 'Query contains a disallowed keyword';
  end if;

  wrapped := format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit %s) t',
    regexp_replace(trim(query_text), ';+\s*$', ''),
    greatest(1, least(row_limit, 5000))
  );

  execute wrapped into result;
  return result;
end;
$$;

revoke all on function public.run_readonly_query(text, integer) from public;
grant execute on function public.run_readonly_query(text, integer) to authenticated;
