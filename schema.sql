-- My Finance schema. Money = integer minor units (piasters). Run in Supabase SQL editor.
create table accounts(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, name text not null, opening bigint not null default 0, created_at timestamptz default now());
create table settings(user_id uuid primary key default auth.uid() references auth.users on delete cascade, living_daily bigint not null default 0);
create table transactions(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, account_id uuid references accounts on delete cascade, kind text not null check (kind in ('income','expense')), amount bigint not null check (amount>0), category text, note text, tx_date date not null default current_date, created_at timestamptz default now());
create table income_sources(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, name text not null, expected bigint not null, pay_day int not null check (pay_day between 1 and 31));
create table obligations(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, name text not null, kind text not null default 'bill', amount bigint not null, freq text not null default 'monthly' check (freq in ('monthly','quarterly','yearly')), next_due date not null);
create table debts(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, name text not null, total bigint not null, remaining bigint not null, monthly bigint not null, due_day int not null check (due_day between 1 and 31));
create table debt_payments(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, debt_id uuid references debts on delete cascade, amount bigint not null, paid_on date not null default current_date);
create table budgets(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, category text not null, monthly bigint not null);
create table funds(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, name text not null, target bigint not null default 0, saved bigint not null default 0);
create index on transactions(user_id, tx_date desc);
do $$ declare t text; begin
 foreach t in array array['accounts','settings','transactions','income_sources','obligations','debts','debt_payments','budgets','funds'] loop
  execute format('alter table %I enable row level security', t);
  execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
 end loop; end $$;
