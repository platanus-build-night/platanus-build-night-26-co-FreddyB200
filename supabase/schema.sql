-- Overlap — schema (seccion 5 del CLAUDE.md)
-- Correr completo en el SQL Editor de Supabase. Es idempotente.

-- events: soporta multi-evento desde hoy (aunque esta noche solo hay uno).
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,                  -- para el QR / URL
  created_at timestamptz default now()
);

-- attendees: el roster. Se llena solo con el onboarding por QR.
create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  github text,
  linkedin text,
  whatsapp text,              -- numero completo con codigo de pais, para wa.me/<numero>
  building text,              -- "What are you building?"
  avatar_color text,          -- hex autogenerado del nombre
  device_token uuid unique default gen_random_uuid(),
  created_at timestamptz default now()
);

-- idempotente: por si la tabla ya existia de antes de agregar whatsapp.
alter table attendees add column if not exists whatsapp text;

-- photos: el pozo compartido.
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  storage_path text not null,        -- ruta en Supabase Storage (bucket "photos")
  uploader_id uuid references attendees(id) on delete set null,
  taken_at timestamptz,              -- del EXIF si existe; si no, created_at (ver seccion 9)
  scene_description text,            -- lo llena /api/analyze (Claude vision)
  created_at timestamptz default now()
);

-- photo_tags: quien sale en cada foto. ESTA TABLA ES LA FUENTE DE LAS ARISTAS.
create table if not exists photo_tags (
  photo_id uuid references photos(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (photo_id, attendee_id)
);

-- photo_likes: para fotos donde no sale nadie tageable pero igual gustan.
-- No alimenta el grafo (eso es solo photo_tags) — es una señal aparte.
create table if not exists photo_likes (
  photo_id uuid references photos(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (photo_id, attendee_id)
);

-- indices: el grafo se deriva al vuelo desde photo_tags, estos lo hacen trivial.
create index if not exists attendees_event_idx on attendees(event_id);
create index if not exists photos_event_taken_idx on photos(event_id, taken_at desc);
create index if not exists photos_uploader_idx on photos(uploader_id);
create index if not exists photo_tags_attendee_idx on photo_tags(attendee_id);

-- ---------------------------------------------------------------------------
-- RLS: permisivo a proposito para la hackathon (ver "Nota de seguridad", sec. 3).
-- Se habilita RLS con politicas abiertas en vez de dejarlo apagado, para que
-- Supabase no marque las tablas como inseguras y para tener un punto unico
-- donde apretar despues (lectura publica / escritura con device_token).
-- ---------------------------------------------------------------------------
alter table events      enable row level security;
alter table attendees   enable row level security;
alter table photos      enable row level security;
alter table photo_tags  enable row level security;
alter table photo_likes enable row level security;

drop policy if exists "open access" on events;
drop policy if exists "open access" on attendees;
drop policy if exists "open access" on photos;
drop policy if exists "open access" on photo_tags;
drop policy if exists "open access" on photo_likes;

create policy "open access" on events      for all using (true) with check (true);
create policy "open access" on attendees   for all using (true) with check (true);
create policy "open access" on photos      for all using (true) with check (true);
create policy "open access" on photo_tags  for all using (true) with check (true);
create policy "open access" on photo_likes for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage: bucket publico "photos" (las fotos se muestran en la galeria por URL).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos public read"   on storage.objects;
drop policy if exists "photos public upload" on storage.objects;

create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos public upload" on storage.objects
  for insert with check (bucket_id = 'photos');
