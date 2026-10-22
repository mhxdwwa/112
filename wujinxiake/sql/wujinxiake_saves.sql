-- ============================================================
--  无尽侠客 · 云存档表
--  用法：打开 Supabase → SQL Editor → New query → 整段粘贴 → Run
--  可以重复执行，不会报错，也不会清掉已有存档
-- ============================================================

create table if not exists public.wujinxiake_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.wujinxiake_saves is '无尽侠客玩家云存档';

-- 行级安全：每个账号只能读写自己那一行
alter table public.wujinxiake_saves enable row level security;

drop policy if exists "wjx own read"   on public.wujinxiake_saves;
drop policy if exists "wjx own write"  on public.wujinxiake_saves;
drop policy if exists "wjx own update" on public.wujinxiake_saves;
drop policy if exists "wjx own delete" on public.wujinxiake_saves;

create policy "wjx own read" on public.wujinxiake_saves
  for select using (auth.uid() = user_id);

create policy "wjx own write" on public.wujinxiake_saves
  for insert with check (auth.uid() = user_id);

create policy "wjx own update" on public.wujinxiake_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wjx own delete" on public.wujinxiake_saves
  for delete using (auth.uid() = user_id);

create index if not exists wujinxiake_saves_updated_idx
  on public.wujinxiake_saves (updated_at desc);

-- ============================================================
--  检查（可选）：执行完可以跑这一句看看表建好了没
-- ============================================================
-- select * from public.wujinxiake_saves limit 5;
