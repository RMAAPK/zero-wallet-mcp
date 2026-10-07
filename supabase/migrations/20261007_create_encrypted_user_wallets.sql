-- ============================================================================
-- Migration: 20261007_create_encrypted_user_wallets.sql
-- Description: Zero-knowledge client-encrypted EVM wallet store with AAL2 RLS.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_net" with schema "extensions";

create table if not exists public.user_wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    public_address text not null,
    key_derivation_salt text not null,
    encrypted_priv_key text not null,
    iv text not null,
    auth_tag text not null,
    daily_spend_limit_usdt numeric(18, 6) not null default 50.000000,
    current_day_spent_usdt numeric(18, 6) not null default 0.000000,
    last_spend_reset timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),

    constraint unique_user_wallet unique (user_id),
    constraint unique_public_address unique (public_address),
    constraint valid_evm_address check (public_address ~ '^0x[a-fA-F0-9]{40}$'),
    constraint valid_spend_limits check (current_day_spent_usdt >= 0 and daily_spend_limit_usdt >= 0)
);

create index if not exists idx_user_wallets_user_id on public.user_wallets (user_id);
create index if not exists idx_user_wallets_public_address on public.user_wallets (public_address);

alter table public.user_wallets enable row level security;
revoke all on public.user_wallets from public, anon;

create policy "Allow read only to owner with verified 2FA"
on public.user_wallets
for select
to authenticated
using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
);

create policy "Allow insert only for own account"
on public.user_wallets
for insert
to authenticated
with check (
    auth.uid() = user_id
);

create policy "Allow update only to owner with verified 2FA"
on public.user_wallets
for update
to authenticated
using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
)
with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
);

create policy "Allow delete only to owner with verified 2FA"
on public.user_wallets
for delete
to authenticated
using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
);

create or replace function public.handle_wallet_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger tr_user_wallets_updated_at
    before update on public.user_wallets
    for each row
    execute function public.handle_wallet_updated_at();
