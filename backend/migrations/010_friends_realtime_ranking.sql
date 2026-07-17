-- 010: friends can read each other's child_profiles + realtime on child_profiles
--
-- child_profiles só tinha a policy "Parent reads own children" (parent_id = auth.uid()).
-- Não existia nenhuma policy que permitisse a um pai ler o child_profiles de um amigo do
-- filho — a migration 002 já assinalava isto ("policy intentionally omitted... will be
-- re-added in Phase 5", nunca chegou a ser feito). Isso faz o embed
-- `friendships -> friend:friend_id(...)` usado em social.service.ts devolver null sob RLS
-- para cada amigo, e é pré-requisito para a notificação de ranking (precisamos de Realtime
-- em child_profiles.xp_total para amigos, não só para os próprios filhos).
--
-- Duas funções security definer (mesmo padrão de handle_new_user em 001) para evitar a
-- recursão 42P17 de uma subquery direta sobre child_profiles dentro da sua própria policy.

create or replace function public.my_child_ids()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select id from public.child_profiles where parent_id = auth.uid();
$$;

create or replace function public.friend_ids_of(ids uuid[])
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select friend_id from public.friendships where child_id = any(ids);
$$;

-- Policy adicional (RLS combina policies permissivas com OR) — não repete a condição
-- "parent_id = auth.uid()" já coberta pela policy "Parent reads own children".
create policy "Friends can read each other's profiles"
  on public.child_profiles for select
  using (id in (select public.friend_ids_of(array(select public.my_child_ids()))));

-- Realtime: necessário para a deteção de ultrapassagem no ranking (subscreve UPDATE em
-- child_profiles.xp_total para o próprio filho + amigos). Replica identity default (primary
-- key) já é suficiente — só precisamos do "new" row, não do "old".
alter publication supabase_realtime add table public.child_profiles;
