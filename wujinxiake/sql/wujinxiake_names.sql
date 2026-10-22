-- 无尽侠客：角色名唯一（跨账号不允许重名）
-- 用法：Supabase → SQL Editor → 粘贴执行（和之前建存档表一样）
-- 不执行也能玩：名字只在「本机」查重，换设备可能撞名

create table if not exists public.wujinxiake_names (
  name       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.wujinxiake_names enable row level security;

-- 所有人可读：需要它是为了让游戏能判断「这个名字有没有被占」
drop policy if exists "wjx names read" on public.wujinxiake_names;
create policy "wjx names read" on public.wujinxiake_names
  for select using (true);

-- 只能占自己的名
drop policy if exists "wjx names ins" on public.wujinxiake_names;
create policy "wjx names ins" on public.wujinxiake_names
  for insert with check (auth.uid() = user_id);

-- 删角色时释放名字
drop policy if exists "wjx names del" on public.wujinxiake_names;
create policy "wjx names del" on public.wujinxiake_names
  for delete using (auth.uid() = user_id);
