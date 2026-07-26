-- ============================================================
-- КАР-точки — миграция 0011: cards.synced_at — серверные часы для дельта-синка
--
-- Зачем: окно дельты («что изменилось с прошлого раза») строилось по
-- updated_at, а его ставит КЛИЕНТ. Из-за этого правка с устройства с
-- отставшими часами приезжала «в прошлое» — мимо окна — и не доезжала до
-- других устройств до ближайшей полной пересинхронизации (до 24 часов).
--
-- Здесь появляется вторая отметка, synced_at, которую ставит сервер. Роли
-- разведены намеренно:
--   • updated_at — время самой правки, по нему решается спор двух устройств
--     (last-write-wins, фильтр updated_at=lt.<наше> в CloudStore);
--   • synced_at — время записи на сервере, по нему двигается watermark
--     дельта-синка. Единые часы для всех устройств.
-- Если бы watermark и LWW жили на одной колонке, устройство с отстающими
-- часами не смогло бы записать НИЧЕГО: его updated_at всегда меньше
-- серверного, каждый PATCH задевал бы 0 строк.
--
-- Триггер BEFORE INSERT OR UPDATE — значит и вставка, и импорт, и экспорт
-- работают как раньше: клиент про synced_at может вообще не знать, а если
-- пришлёт — значение всё равно перезапишется серверным.
-- ============================================================

alter table public.cards add column if not exists synced_at bigint not null default 0;

-- Бэкфилл одним серверным временем: все существующие строки получают одну и ту
-- же отметку, поэтому старые клиенты с watermark по updated_at ничего не теряют
-- (их первый синк после миграции всё равно будет полным — вид часов сменился).
update public.cards set synced_at = (extract(epoch from now()) * 1000)::bigint
  where synced_at = 0;

create or replace function public.cards_stamp_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := (extract(epoch from now()) * 1000)::bigint;
  return new;
end;
$$;

drop trigger if exists cards_stamp_synced_at on public.cards;
create trigger cards_stamp_synced_at
  before insert or update on public.cards
  for each row execute function public.cards_stamp_synced_at();

-- Индекс под запрос дельты: where user_id = ? and synced_at > ?
create index if not exists cards_user_synced_at_idx
  on public.cards (user_id, synced_at);

insert into public.schema_meta (id, version)
values (1, 11)
on conflict (id) do update
  set version = greatest(public.schema_meta.version, excluded.version),
      updated_at = now();
