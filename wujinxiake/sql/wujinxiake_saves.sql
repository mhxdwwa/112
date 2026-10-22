-- ============================================================
--  无尽侠客 · 云存档表
--  操作：Supabase 控制台 → 左侧 SQL Editor → New query
--       把下面 6 行整段粘贴进去 → 点 Run
--  可以重复执行，不会报错，也不会清掉已有存档
-- ============================================================

create table if not exists public.wujinxiake_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wujinxiake_saves enable row level security;

drop policy if exists "wjx self" on public.wujinxiake_saves;

-- 每个账号只能读写自己那一行
create policy "wjx self" on public.wujinxiake_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
