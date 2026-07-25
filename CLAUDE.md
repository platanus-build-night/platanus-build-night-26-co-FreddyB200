# CLAUDE.md — Overlap

> Contexto completo del proyecto. Si eres una instancia nueva: lee este archivo + el log de commits (`git log --oneline`) y tendrás todo. Este archivo es la fuente de verdad; los commits son el timeline. **La app (UI/copy) es en INGLÉS. El desarrollo, comentarios y estos docs son en español.**

---

## 0. Qué es esto (en una línea)

**El problema:** en eventos dev, las mejores fotos se quedan atrapadas en un solo celular y nunca llegan, y conoces gente que al día siguiente no vas a recordar. Ambas cosas se evaporan.

**La solución:** un pozo donde todos suben fotos y todos reciben las suyas — y como las fotos se etiquetan con quién sale, la app arma sola el **grafo de a quién conociste** ("overlap"), con su GitHub para no perder el contacto.

**Contexto:** side project para la Platanus Build Night (hackathon, voto por popularidad). Gana lo útil, cool y humano, NO lo técnicamente complejo. Nicho: **eventos dev (hackathons, meetups)**.

**Idioma:** UI y todo el copy visible → INGLÉS ("That's me", "Save my photos", "Connect on GitHub", "Your night's overlap"). Código/comentarios/docs → español.

---

## 1. Lo que SÍ se construye esta noche (en orden)

El grafo es el corazón. Construir en este orden estricto — cada capa debe funcionar antes de pasar a la siguiente:

1. **Onboarding + Colector** — QR → "Who are you?" (name, GitHub, LinkedIn opcional, "What are you building?") → identidad guardada. Subir fotos desde la cámara del cel.
2. **Galería + auto-tag** — todos ven las fotos; cada quien se toca a sí mismo en las que sale ("That's me") → recupera sus fotos Y alimenta el grafo en el mismo gesto.
3. **Grafo + Dossier** — por persona: con quién coincidió (aristas = fotos compartidas), la evidencia visual, y el mensaje de follow-up + link a GitHub. **Este es el clímax de la demo.** El grafo se calcula igual (`src/lib/graph.ts`), pero desde que se importó el lenguaje visual canónico (sección 6) el Dossier se ve como un recap — hero + tira de fotos + riel de gente — en vez de una visualización de grafo en vivo; ver nota en sección 6.
4. **UX/pulido** — aplicar los tokens de diseño (sección 6).

## 2. Lo que NO se construye esta noche (guardarraíles — no expandir scope)

- ❌ Login tradicional / contraseñas / OAuth. Solo identidad sin auth (ver sección 4).
- ❌ Reconocimiento facial / biometría. El tagging es humano (un tap). Plus de privacidad.
- ❌ Mensajería in-app. "Connect" = un botón que abre su GitHub/LinkedIn.
- ❌ Creador de avatar. Chip de iniciales sobre color autogenerado.
- ❌ Video, curaduría por calidad, dashboard de organizador, sponsors, integración Luma/Meetup.
- ❌ El post de LinkedIn generado por IA como feature central. Guarnición opcional al final si sobra tiempo.
- ❌ **Pasaporte cross-evento** (ver sección 5.1). El SCHEMA lo soporta desde hoy (campo `event_id`), pero la vista "coincidieron en N eventos" NO se construye — solo hay un evento con data esta noche. Es visión de pitch, no build.

**Regla de oro:** el clímax de la demo debe ser un momento de DATA (el grafo de esta sala), no un momento de LLM (un texto generado). ChatGPT no tiene la data; ese es el foso.

---

## 3. Stack (bloqueado)

- **Frontend:** React + Vite + TypeScript + Tailwind CSS. Deploy en Vercel.
- **Datos + Storage:** Supabase (Postgres + Storage). Acceso desde el cliente con `@supabase/supabase-js` (anon key). Para la hackathon, RLS permisivo (ver nota de seguridad).
- **IA (visión):** UNA función serverless de Vercel (`/api/analyze.ts`) que llama a la API de Anthropic con `@anthropic-ai/sdk`. La API key vive SOLO en env de Vercel, nunca en el cliente.
- **Grafo:** derivado en el cliente desde `photo_tags`. Sin librería de grafos pesada; ver sección 5.

### 3.1. Setup inicial (el agente hace esto ANTES de codear)

1. **Supabase:** conéctate al MCP de Supabase y crea el proyecto. Corre `supabase/schema.sql` y `supabase/seed.sql`. Devuelve al usuario las env vars (URL + anon key) para pegarlas. **Si el MCP de Supabase no está habilitado, no te quedes pegado — crea el proyecto por dashboard/CLI y sigue.**
2. **Anthropic SDK:** instala `@anthropic-ai/sdk` y configura `/api/analyze.ts` como función serverless de Vercel. `ANTHROPIC_API_KEY` va en env, nunca en el cliente. Explica en una línea dónde pega cada key.
3. Cuando ambos estén listos, empieza por la **capa 1** (sección 1).

### Estructura del repo (monorepo, un solo Vercel project)

```
overlap/
  index.html
  package.json
  vite.config.ts
  tailwind.config.ts
  CLAUDE.md              <- este archivo
  api/
    analyze.ts           <- serverless: foto -> descripción de escena (Claude vision)
  src/
    lib/supabase.ts
    lib/graph.ts         <- construye aristas desde photo_tags
    components/
    screens/
      Onboard.tsx
      Capture.tsx        <- subir fotos
      Gallery.tsx        <- ver + auto-tag
      Dossier.tsx        <- "Your night's overlap" (HERO)
  supabase/
    schema.sql
    seed.sql             <- anclas reales: tú, tu amigo, los ~5 con GitHub
```

### Nota de seguridad (honesta, no rabbit-hole)
La anon key de Supabase es pública por diseño. Con RLS apagado, cualquiera con la key puede leer/escribir. **Para el demo de esta noche es aceptable.** Si sobra tiempo al final, activar RLS mínimo. No gastar tiempo en esto antes de tener las 3 primeras capas funcionando.

---

## 4. Identidad sin auth

- Al registrarse (tras escanear QR) se crea una fila en `attendees` con un `device_token` (uuid).
- Ese token se guarda en `localStorage`. En ese navegador el usuario "es" ese attendee para siempre, sin volver a ver registro.
- Sin email, sin contraseña, sin recuperación. Cambio de dispositivo = re-registro. Suficiente para esta noche.

---

## 5. Modelo de datos

```sql
-- events: soporta multi-evento desde hoy (aunque esta noche solo hay uno).
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,                  -- para el QR / URL
  created_at timestamptz default now()
);

-- attendees: el roster. Se llena solo con el onboarding por QR.
-- Nota: un attendee es por-evento aquí (identidad ligada al device). El pasaporte
-- cross-evento (sección 5.1) se resolverá luego uniendo por github/device; no hoy.
create table attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  name text not null,
  github text,
  linkedin text,
  whatsapp text,              -- numero completo con codigo de pais, para wa.me/<numero>
  building text,              -- "What are you building?" — contexto dev, alimenta el dossier
  avatar_color text,          -- hex autogenerado del nombre
  device_token uuid unique default gen_random_uuid(),
  created_at timestamptz default now()
);

-- photos: el pozo compartido.
create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  storage_path text not null,        -- ruta en Supabase Storage
  uploader_id uuid references attendees(id),
  taken_at timestamptz,              -- del EXIF si existe; si no o si es basura, se setea a mano (ver sección 9)
  scene_description text,            -- lo llena /api/analyze (Claude vision)
  created_at timestamptz default now()
);

-- photo_tags: quién sale en cada foto. ESTA TABLA ES LA FUENTE DE LAS ARISTAS.
create table photo_tags (
  photo_id uuid references photos(id),
  attendee_id uuid references attendees(id),
  primary key (photo_id, attendee_id)
);
```

**Grafo (derivado, en `src/lib/graph.ts`):** dos attendees tienen arista si comparten ≥1 foto (misma `photo_id` en `photo_tags`). Peso = número de fotos compartidas. No se persiste; se calcula al vuelo. Con ~25 personas y ~25 fotos es trivial en memoria.

**Dossier de un attendee X:**
- Sus fotos = `photos` join `photo_tags where attendee_id = X`.
- Sus coincidencias = otros attendees que comparten alguna foto con X, ordenados por peso.
- Momento compartido con Y = las fotos que X e Y comparten (evidencia visual, tap para verla a pantalla completa con `scene_description` + `taken_at`) + el rango horario real (`sharedRange` en `graph.ts`). **NO inventar de qué hablaron** — solo afirmar el momento compartido real. El follow-up engancha en ese momento real.
- Conexión: GitHub es el canal primario (siempre que la persona lo haya compartido); LinkedIn y WhatsApp (`wa.me/<numero>`) son botones-ícono secundarios, solo si esa persona los agregó en el onboarding.

### 5.1. Pasaporte cross-evento (ROADMAP — no construir hoy)
El `event_id` en `attendees`/`photos` permite, mañana, la vista "tú y Andrés coincidieron en N eventos" (misma query del grafo, agrupando por evento en vez de por foto, uniendo identidades por `github` o `device_token`). Hoy hay un solo evento → mostrarlo daría "1 evento" y no impresiona. **Se vende en el pitch, no se construye.** Frase de cierre del pitch: *"Y esto es solo una noche. Overlap recuerda cada evento — ves con quién te sigues cruzando en la escena, hackathon tras hackathon."*

---

## 6. Diseño — lenguaje visual canónico ("film")

> **Fuente de verdad de los tokens:** un proyecto de Claude Design (`Overlap Recap.dc.html`,
> importado vía `claude_design` MCP) es el diseño canónico. Lo que sigue es lo que se extrajo
> de ahí; si hay que tocar diseño de nuevo, ese archivo manda sobre esta descripción.

**Concepto:** una galería oscura y cálida de trasnoche, tipo print de película — sin negro puro,
sin neón, sombras mates. Las FOTOS son el color; todo lo demás es contención.

**Evitar los 3 clichés de diseño AI:** (1) fondo crema + serif + acento terracota/coral ≈ #D97757, (2) negro puro + verde ácido/bermellón, (3) layout tipo periódico con líneas hairline. NO usar ninguno.

**Paleta (`src/index.css`, tokens Tailwind v4 vía `@theme` — un único acento, sin codificar estados en rojo/verde):**
- `--color-night` `#16151A` — fondo, casi negro pero cálido
- `--color-surface` `#201E26` — cards, tiras de foto
- `--color-border` `#2C2A33` — hairlines (reemplaza los `border-white/10` originales)
- `--color-ink` `#EFEBE2` — texto principal, crema
- `--color-muted` `#8A868F` — texto tenue
- `--color-signal` `#C6A15B` — dorado, único acento: tu marca, CTAs, highlights

**Tipografía:**
- Display (héroe, headings, botones): **Space Grotesk**, peso 500 (medium) — nunca bold/700, es parte de la voz tranquila del sistema.
- Body: **Geist**
- Mono (@handles de GitHub, timestamps, eyebrows uppercase): **JetBrains Mono**

**Avatares:** chip de iniciales sobre color autogenerado (`src/lib/avatar.ts`) — paleta desaturada "film" (dorado, terracota, salvia, lavanda apagada, pizarra, rosa polvo, taupe, menta apagada), nunca tonos saturados/neón.

**Elemento firma — el Dossier como recap, no como grafo:** el grafo sigue siendo la fuente de
datos (`src/lib/graph.ts`, aristas = fotos compartidas), pero ya NO se dibuja como constelación
SVG. El Dossier es un recap: hero con tu conteo real de fotos, una tira horizontal de tus fotos
(scroll-snap, ligera inclinación alternada, fan por foto — imita un stack de prints físicos), y
UNA sola sección "Who you overlapped with" donde el riel de caras es el índice y tocar una cara
expande su card inline (nombre, @github, "what they're building", fotos compartidas, conectar).
Se anima una sola vez al cargar (`ov-rise`/`ov-fade` en `index.css`; respeta `prefers-reduced-motion`).

**Chrome compartido:** `TopBar` (marca + nombre del evento + reloj en vivo) arriba de cada
pantalla; `PhotoLightbox` es el visor de foto a pantalla completa (hora + escena + quién está
tageado), compartido entre Gallery y Dossier.

**Copy (INGLÉS, voz de interfaz):** verbos activos, sentence case, sin relleno. "That's me" no "Tag". "Save my photos" no "Submit". Empty state que invita: "No photos yet — be the first to add one."

---

## 7. API de Anthropic (visión)

- Endpoint: `POST https://api.anthropic.com/v1/messages` vía `@anthropic-ai/sdk`.
- **Modelo para describir escenas (alto volumen, barato/rápido):** `claude-haiku-4-5-20251001`.
- Modelo opcional para prosa del dossier (bajo volumen, mejor redacción): `claude-sonnet-5`.
- Si un model string da error, verificar el actual en https://docs.claude.com/en/api/overview.
- Visión: mandar la imagen como bloque `image` (base64 o URL) + un bloque `text` con el prompt.
- Prompt de escena (system): "Describe en una frase corta y concreta el momento de esta foto de un evento tech: qué pasa, objetos visibles (whiteboard, laptops con código, comida, alguien presentando), y la energía. NO inventes nombres ni conversaciones. Responde en inglés."

`/api/analyze.ts` recibe la ruta/URL de la foto, llama a Claude, y devuelve `scene_description` que se guarda en `photos`.

### Env vars
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...        # solo server-side, en env de Vercel
```

---

## 8. Reglas de trabajo del agente

1. **Commits frecuentes y descriptivos.** Tras cada milestone que funcione, commit: `feat(gallery): auto-tag guarda en photo_tags`. Es el mecanismo de recuperación de contexto entre instancias.
2. **Construir en el orden de la sección 1.** No saltar a la capa 3 sin la 1 y 2. MVP funcional primero, pulido después.
3. **No expandir scope.** Respetar sección 2. Si algo parece "buena mejora", casi siempre es scope creep — recordárselo al usuario en vez de agregarlo.
4. **Antes de acciones destructivas** (borrar tablas, reescribir archivos grandes, cambios de arquitectura) — confirmar con el usuario.
5. **El usuario es backend dev, no frontend.** No dejar el frontend a medias esperando que él lo arregle. Explicar decisiones de frontend brevemente.
6. **Deploy temprano.** La capa 1 desplegada y viva cuanto antes para que las fotos reales empiecen a entrar durante la noche.
7. **Trabaja tramos largos sin interrumpir.** Solo devuelve el control al usuario para: (a) pegar env vars/keys, (b) confirmar algo destructivo, (c) una capa terminada y desplegada. No preguntar por decisiones ya cerradas en este doc.

---

## 9. Nota de demo (honestidad)

- **Fotos:** reales, tomadas esta noche en el evento. Nada de fotos generadas con IA (se verían falsas).
- **EXIF/timestamps:** algunas fotos vienen de cámara digital y pueden traer EXIF raro o borrado. Para el demo, el campo `taken_at` se setea a mano para reconstruir la línea de tiempo de la noche. **Se aclara en el pitch:** "los timestamps del demo están sembrados; en producción salen del EXIF de cada foto." El campo es independiente del archivo, así que es trivial.
- **Múltiples uploaders:** el usuario sube fotos de varias cámaras (la suya, la de su amigo) — colaboradores reales. Frase: "cargué el evento de hoy con fotos reales para mostrar el flujo; en producción cada invitado sube las suyas." Nunca afirmar que usuarios falsos subieron nada.
