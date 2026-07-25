-- Overlap — seed
-- Correr DESPUES de schema.sql.
--
-- Honestidad (seccion 9 del CLAUDE.md): NO sembramos attendees falsos. Lo unico
-- que se siembra aca es el evento, para que el QR tenga a donde apuntar. Los
-- attendees se crean solos con el onboarding real de cada persona esta noche.

insert into events (name, slug)
values ('Platanus Build Night', 'build-night')
on conflict (slug) do nothing;

select id as event_id, name, slug from events where slug = 'build-night';

-- ---------------------------------------------------------------------------
-- OPCIONAL — anclas reales (tu, tu amigo, los ~5 con GitHub que ya conoces).
-- Descomentar y reemplazar con datos REALES de personas que efectivamente estan
-- en el evento. No inventar personas: el pitch se apoya en que la data es real.
-- ---------------------------------------------------------------------------
-- insert into attendees (event_id, name, github, building)
-- select id, 'Freddy Bautista', 'freddybautista', 'Overlap'
-- from events where slug = 'build-night';
