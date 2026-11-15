# Lunar Landing Site Simulator

[English](README.md) · **Español**
(Si alguna vez las dos versiones no coinciden, la versión en inglés es la referencia).

Una herramienta web para **comparar sitios y fechas de alunizaje**. La **Orbital
view** es un globo 3D de la Luna con mapas de la NASA donde eliges un sitio o una
zona. La **Horizon view** te pone en la superficie de ese sitio y muestra dónde
están el **Sol** (energía) y la **Tierra** (comunicación directa) en el cielo a
cualquier hora, y si el **terreno real** los tapa. Dirección web:
**concordemoon.com**.

Hecho para el **NASA Space Apps Challenge 2026**, reto *"Lunar Landing Site
Simulator"*. Sitios actuales: **borde de Shackleton, Connecting Ridge C1 y C2**
(polo sur), **Mons Mouton, Malapert A y la cuenca Schrödinger** (sitios de
alunizaje del programa CLPS de la NASA) y **Apollo 11, 16 y 17**. Periodo actual:
**90 días, del 2026-11-14 al 2027-02-12 UTC**, cada hora.

> **Herramienta de apoyo para planear, no de grado de vuelo** ("Planning aid,
> not flight grade"). Cada número sale de datos públicos de la NASA y está
> comparado con una fuente independiente (ver [Validación](#6-validación)), pero
> es una herramienta de hackathon, no software de misión.

**Estado (2026-11-15).** Funciona: el **Dashboard**, la **Orbital view** con 5
capas de mapa, la **Horizon view** con sombras reales y cielo de estrellas real,
**Compare sites** (hasta 3 escenarios de sitio y fecha con un puntaje por
objetivo), 9 sitios, fecha de llegada y duración de la estancia, requisitos con
mapa de zonas en el polo sur, y las misiones CLPS de cada sitio. El asistente de
IA está construido (necesita una llave del modelo, ver
[`docs/AI_ASSISTANT_PLAN.md`](docs/AI_ASSISTANT_PLAN.md)) y conoce las cuatro
pestañas. Todavía no está: zonas para toda la Luna, coordenadas personalizadas,
los KPIs de impacto del Dashboard (solo marcadores, sin números inventados) y los
datos de tres sitios CLPS más (Mare Crisium, Reiner Gamma, Gruithuisen Domes). Ver
[Siguientes pasos](#10-siguientes-pasos).

La historia completa del proyecto (cada decisión, problema, solución, idea
descartada y corrección) está en [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md)
(en inglés).

---

## Contenido

1. [El reto](#1-el-reto)
2. [Qué hace la app](#2-qué-hace-la-app)
3. [Cómo correrla](#3-cómo-correrla)
4. [Cómo funciona](#4-cómo-funciona)
5. [Datos y fuentes](#5-datos-y-fuentes)
6. [Validación](#6-validación)
7. [Datos reales vs ayudas visuales](#7-datos-reales-vs-ayudas-visuales)
8. [Limitaciones conocidas](#8-limitaciones-conocidas)
9. [Opciones descartadas](#9-opciones-descartadas)
10. [Siguientes pasos](#10-siguientes-pasos)
11. [Estructura del proyecto](#11-estructura-del-proyecto)
12. [Regenerar los datos](#12-regenerar-los-datos)
13. [Créditos](#13-créditos)

---

## 1. El reto

Las misiones al polo sur lunar tienen límites extremos de luz y de comunicación.
El Sol se queda a menos de unos 1.5° del horizonte, así que una cresta pequeña
puede cortar la energía solar; la Tierra también está baja, así que el terreno
puede bloquear la comunicación directa por radio. Ya existen herramientas que
calculan esto (NASA Quickmap, Moon Trek, JPL Horizons), pero están hechas para
expertos y hay que usar varias para responder una sola pregunta.

El reto pide una herramienta intuitiva para **comparar sitios y fechas rápido**,
mostrando el Sol y la Tierra respecto al horizonte para evaluar la **generación
de energía** y la **comunicación directa con la Tierra**. Casi todos los puntos
del reto son opcionales ("you may consider"). Criterios de evaluación a tener en
cuenta: Impact, Creativity, **Validity**, Relevance, Presentation.

**Nuestro enfoque:** pocos sitios bien hechos y comparación rápida. Una vista en
primera persona donde lo que *ves* (el terreno tapando la Tierra) y lo que *dicen*
los números salen de los mismos datos de la NASA, con un mapa para elegir y
comparar sitios y fechas, y cada número validado.

## 2. Qué hace la app

Una barra a la izquierda cambia entre el **Dashboard**, la **Orbital view**, la
**Horizon view** y **Compare sites**; un botón de chat abajo abre el asistente de
IA. La app abre en la Orbital view, con la dirección limpia (`/`). Los paneles son
tarjetas gris oscuro sobre las vistas, con azul NASA para botones y elementos
seleccionados y un poco de rojo NASA solo en detalles pequeños. Los interruptores
y deslizadores son blancos.

**Orbital view (el globo de la Luna)**

- Una esfera 3D lisa de la Luna (CesiumJS) con imágenes de NASA Moon Trek. Carga
  solo los tiles del mapa que necesita para el zoom actual, así que necesita
  internet. Haz clic en cualquier punto para ver latitud y longitud (grados
  este, 0 a 360).
- **Map layer**, una a la vez: Image (mosaico de fotos de LRO), Hillshade,
  Elevation, Slope y Temperature (noche, máxima, mínima). La tarjeta de cada capa
  da la fuente, la cobertura y sus límites. No hay leyendas con valores porque
  Moon Trek no las da para estos tiles. Cerca del polo sur, Hillshade y Elevation
  agregan el modelo del polo sur de LOLA a 5 m.
- Menú **Site** (South pole: Shackleton rim, Connecting Ridge C1, C2. Misiones
  CLPS: Mons Mouton, Malapert A, Schrödinger Basin. Apollo landing sites: 11, 16,
  17) o clic en un marcador: la cámara vuela ahí. Del sitio
  elegido ves la fecha y hora, la **duración de la estancia**, las **misiones
  CLPS** que aterrizan ahí (completadas o programadas, con año), un botón de
  bandera **Compare**, el % de la estancia
  con Sol y con enlace a la Tierra, un **Horizon preview** (el horizonte real con
  el Sol y la Tierra, que se esconden detrás del terreno), una foto de la zona
  (**Topography**) y los botones *Open Horizon view*, *Topography view* y *Back to
  globe*.
- **Requirements** (Sol durante la estancia, enlace con la Tierra durante la
  estancia, pendiente en el sitio). Cada uno se puede apagar. Marcan los 9 sitios
  (✓ verde cumple, ✕ gris excluido) y, con **Show on map**, colorean **2,500
  celdas de zona** de 1 km alrededor del polo sur (verde cumple, gris tenue no).
  Todo se recalcula al cambiar la fecha de llegada, la duración o un umbral. Haz
  clic en una celda para ver sus valores. Redacción: *solo tamizaje, no
  "seguro"*.

**Horizon view (primera persona, desde el sitio)**

- **Barra izquierda**: nombre y coordenadas del sitio, fecha y hora (deslizador
  sobre 2,161 muestras cada hora), **Sun (power)** y **Earth (direct link)**
  (estado ●/◐/○, hora de puesta o salida al minuto, elevación, azimut, horizonte
  del terreno ahí, fracción iluminada de la Tierra), el panel **Stay** (% de la
  estancia con Sol y Tierra), el **resumen del periodo** y los créditos.
- **Área principal**: cámara en primera persona a 2 m del suelo (altura del
  módulo), solo miras alrededor. Arrastra para mirar, rueda o pellizco o **− / +**
  para zoom (campo de visión de 60° a 2°), **Look at Sun / Look at Earth**.
  Terreno real de LOLA con **sombras proyectadas reales**, los discos del Sol y la
  Tierra a su **tamaño angular real** (la Tierra con su fase real y el lado que
  mira a la Luna), una brújula y una línea gris delgada en el horizonte
  calculado. **← Back to Orbital view** conserva la fecha. El cielo es un mapa de
  estrellas real (Tycho-2) más estrellas puntuales. La barra lateral flota sobre la
  vista como una tarjeta y también muestra las misiones CLPS del sitio y un botón
  de bandera **Compare**.

**Dashboard (primera pestaña)**

- Una portada **Welcome** con el menú de sitios, la fecha de llegada, la duración
  de la estancia, los botones *Open Horizon view* y *Compare sites*, y un
  interruptor **Simple / Detailed** (Simple oculta columnas técnicas).
- **Números clave**: medidores circulares del % de la estancia con Sol y con
  enlace a la Tierra (con el cambio frente a la estancia anterior de la misma
  duración), y dos cuentas regresivas estilo centro de control: *Sunset in /
  Sunrise in* y *Earthset in / Earthrise in*.
- **Your stay, hour by hour**: elevación del Sol y la Tierra durante la estancia,
  con dos barras: *Power* (Sol sobre el horizonte real del terreno) y *Link*
  (Tierra sobre él).
- **Sky now**: el horizonte real de 360° con el Sol y la Tierra, más la altura del
  Sol y de la Tierra, el hueco más largo sin Sol y la pendiente.
- **90 días de luz solar** de cada sitio (parte de cada día UTC con Sol). Un clic
  en un día fija la fecha de llegada; el contorno es tu estancia.
- **Best sites for your goal**: todos los sitios ordenados por objetivo (Power,
  Communications, Safe landing, Balanced), con *Export CSV*.
- **Impact**: KPIs como horas de planeación ahorradas. Son **marcadores** (`—`)
  hasta que la investigación del equipo los defina; no se inventan números
  (`src/data/kpis.ts`).

**Compare sites**

- Hasta **3 escenarios**, cada uno un **sitio más una fecha de llegada**. Se
  agregan con el botón de bandera *Compare* de cualquier sitio, o desde el espacio
  vacío. *Same site, 7 days later* copia una tarjeta una semana después (qué pasa
  si el lanzamiento se retrasa).
- Las tarjetas se **arrastran**: la posición es tu propio orden (**1st, 2nd,
  3rd**). *Order by model suggestion* las ordena por puntaje.
- Cada tarjeta: fecha de llegada, un **puntaje de objetivo** de 0 a 100, la vista
  previa del horizonte, cinco barras (tiempo con Sol, continuidad del Sol = el hueco
  más corto sin luz, altura media del Sol, tiempo con la Tierra, planicie), una
  estrella en la mejor tarjeta de cada barra, si cumple los requisitos por defecto
  y las misiones CLPS. Un radar superpone las tarjetas.
- El puntaje más alto recibe una etiqueta aparte, **Model suggestion**. No cambia
  tu orden 1st/2nd/3rd. El puntaje es un promedio ponderado transparente (ver
  [4.13](#413-puntaje-del-dashboard-y-compare)), no una IA.

**Compartido por todas las vistas:** la fecha y hora y la duración de la estancia.
La barra de direcciones guarda la pantalla
(`?view=orbital|horizon|dashboard|compare&site=<id>&t=<UTC>&stay=<días>&cmp=<sitio>@<UTC>,...`),
así que un enlace reabre la misma pantalla y la misma comparación. La dirección
limpia `/` se usa solo en la portada sin tocar.

**Ejemplos (historia para el pitch)**

- Borde de Shackleton, 2026-11-17 00:00 UTC: la Tierra está a medias detrás de una
  cresta (52% del disco visible) y la siguiente pérdida de enlace directo es el
  2026-12-01 02:34 UTC. El 11-17 12:00 se ve incluso a -0.40° de elevación,
  porque desde el borde alto el terreno baja a unos -1.35° ahí; una herramienta
  de horizonte plano diría que está oculta. En los 90 días: Sol 99%, enlace con la
  Tierra 55%.
- Cambios pequeños de lugar importan: a 16 km de Shackleton, Connecting Ridge C2
  pierde el Sol el 2026-11-14 a las 09:10 UTC detrás de terreno a 0.76°.
- Llegada 2026-11-28, estancia de 6.5 días: los tres sitios del polo sur mantienen
  el Sol el 100% de la estancia, mientras que Apollo 11, 16 y 17 solo tienen 28%,
  40% y 17% (noche lunar), pero tienen la Tierra el 100% del tiempo.
- Misma fecha y requisitos por defecto: cumplen 53 de las 2,500 celdas del polo
  sur.

## 3. Cómo correrla

Requisitos: **Node.js** (probado con v25.2.1, npm 11.9.0).

```bash
npm install
npm run dev
```

Abre la dirección que imprime Vite (http://localhost:5173). Todos los datos de los
sitios ya están en `public/data`. La **Horizon view funciona sin internet**; la
**Orbital view necesita internet** para los tiles de mapa de NASA Moon Trek. La app
abre en la Orbital view. La carga es bajo demanda: la primera descarga es pequeña
(unos 0.3 MB de código de la app); CesiumJS (unos 4 MB) se carga solo para la
Orbital view y el código 3D de la Horizon view (cerca de 1 MB) solo cuando se abre
esa pestaña. El terreno de un sitio (unos 19 MB en un sitio del polo sur, 30 MB en
los dos sitios CLPS cercanos al polo, unos 1.3 MB en un sitio Apollo) se carga solo
cuando se abre su Horizon view; las vistas previas y el Dashboard usan solo cerca de
1 MB por sitio.

Otros comandos:

```bash
npm run build    # revisión de tipos (no se permite `any`) + build de producción en dist/
npm run lint     # oxlint
npm run preview  # sirve el build de producción
```

Los scripts de Python solo se necesitan para **regenerar** los datos
(ver [sección 12](#12-regenerar-los-datos)).

**Publicarla.** Es un sitio estático (Vite): Vercel detecta `npm run build` y la
carpeta de salida `dist`. Publica solo el proyecto `concorde` (no la carpeta
`scripts`). `package.json` pide Node 22 o más nuevo. La dirección canónica y la
vista previa para redes (título, descripción, imagen) están en `index.html` para
`https://concordemoon.com`.

**Asistente de IA.** Una función serverless, `api/chat.ts`, guarda la llave del
modelo (Vercel la ejecuta; `npm run dev` la sirve con un plugin en
`vite.config.ts`). En local copia `.env.example` a `.env.local`, y en Vercel pon
los mismos nombres en las variables de entorno. Nunca uses el prefijo `VITE_` para
la llave. Sin llave, el resto de la app funciona y el panel del asistente dice que
no está configurado. Diseño, límites y set de pruebas:
[`docs/AI_ASSISTANT_PLAN.md`](docs/AI_ASSISTANT_PLAN.md),
[`docs/AI_ASSISTANT_EVAL.md`](docs/AI_ASSISTANT_EVAL.md).

## 4. Cómo funciona

### 4.1 Arquitectura

```
API de NASA/JPL Horizons ──► scripts/fetch_horizons.py ──► public/data/<sitio>/sky.json
DEM LOLA de NASA PGDA (COG) ─► scripts/build_terrain.py ──► public/data/<sitio>/horizon.json
                                                        └─► public/data/<sitio>/terrain_*.f32 + terrain.json
                                    │
                     (todo precalculado, archivos estáticos)
                                    ▼
       App Vite + React + TypeScript (src/) lee los archivos y dibuja
       la barra lateral (métricas) y la vista 3D (three.js / react-three-fiber)
```

**Todo lo pesado se precalcula en Python.** El navegador nunca llama a una API:
la demo tiene que funcionar con mal wifi, y Horizons no documenta CORS (acceso
desde el navegador).

### 4.2 Sistema de coordenadas de la escena (importante)

Toda la geometría 3D está en el **sistema local del sitio**:
`x = este`, `y = arriba`, `z = -norte` (metros). El suelo del sitio está en el
origen; el ojo está en `(0, 2, 0)`. El **azimut** se mide desde el norte en el
sentido del reloj (0 = N, 90 = E), igual que JPL Horizons. La **elevación** se
mide desde el plano horizontal local de la esfera de referencia (radio
1737.4 km), también como en Horizons. La curvatura de la Luna está incluida
porque cada punto del terreno se coloca primero sobre la esfera.

### 4.3 Posiciones del Sol y la Tierra

`scripts/fetch_horizons.py` le pide a Horizons una **tabla de observador** desde
un punto sobre la Luna (`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`,
`SITE_COORD='203.97,-89.7849,0'`), con objetivos Sol (`10`) y Tierra (`399`),
cada hora. Cantidades:

| Código | Significado | Para qué se usa |
|---|---|---|
| 1 | RA/DEC astrométricas (ICRF) | Orientación de la Tierra (textura) |
| 4 | Azimut y elevación aparentes (sin atmósfera) | Posiciones en el cielo |
| 10 | Fracción iluminada | "Lit fraction" de la Tierra |
| 13 | Diámetro angular | Tamaño real de los discos (Tierra ≈ 1.80°, Sol ≈ 0.54°) |
| 14 | Sub-longitud / sub-latitud del observador | Qué lado de la Tierra mira a la Luna |

Horizons no aplica refracción atmosférica para sitios fuera de la Tierra (la Luna
no tiene atmósfera) y su elevación no considera el terreno. El terreno es nuestra
parte.

### 4.4 Terreno

Fuente: **DEM del polo sur de LOLA a 20 m/píxel**, `LDEM_80S_20MPP_ADJ.TIF`
(NASA PGDA producto 90, Barker et al. 2023). Es un **Cloud-Optimized GeoTIFF**
de 2.7 GB: leemos por HTTP solo las ventanas que necesitamos, así que nunca se
descarga completo. Cubre ±304 km alrededor del polo, en metros de proyección
estereográfica polar sur, sistema MOON_ME de DE421 (el mismo que usa Horizons
para sitios lunares), con alturas en metros sobre una esfera de 1737.4 km.
Trae niveles de menor resolución integrados (40, 80, 160, 320, 640, 1280 m).

`scripts/build_terrain.py` genera:

- **Perfil de horizonte** (`horizon.json`): para cada azimut (cada 0.25°,
  1440 valores), el ángulo más alto del terreno visto desde el ojo (2 m sobre el
  suelo), hasta **200 km**. Se trazan rayos con datos de 20 m hasta 20 km, de
  80 m hasta 60 km y de 160 m hasta 200 km. Cada muestra se convierte a
  coordenadas 3D reales de la Luna y su azimut/elevación se calcula en el sistema
  local del sitio, así que la curvatura y la dirección del norte son exactas.
  (Cerca del polo, el "norte" del mapa no es el norte local; trabajar en 3D evita
  esa trampa).
- **Tres mallas de terreno** para la vista 3D, con la posición 3D exacta de cada
  punto en el sistema de la escena:

  | Malla | Resolución | Extensión | Puntos | Archivo |
  |---|---|---|---|---|
  | near (cerca) | 20 m | ±10 km | 1000 × 1000 | `terrain_near.f32` (12 MB) |
  | mid (media) | 320 m | ±80 km | 500 × 500 | `terrain_mid.f32` (3 MB) |
  | far (lejos) | 640 m | ±200 km | 625 × 625 | `terrain_far.f32` (4.7 MB) |

  `terrain.json` guarda los tamaños, la procedencia y un mapa afín aproximado
  (columna/fila de la malla → x/z de la escena), que solo se usa para buscar
  alturas en el shader de sombras.

### 4.5 Visible, parcialmente oculto, oculto

Para el Sol o la Tierra en un momento dado tomamos el horizonte del terreno en su
azimut (interpolación lineal entre valores) y lo comparamos con el disco:

- **Visible**: el disco completo está arriba del terreno.
- **Partly hidden** (parcialmente oculto): una parte del disco está tapada
  (mostramos el % visible, tratando el horizonte como una línea recta sobre el
  disco, que es pequeño).
- **Hidden** (oculto): no se ve ninguna parte del disco.

**Parcialmente oculto cuenta como visible para comunicación**, que es la regla de
los mapas de visibilidad de la Tierra de NASA PGDA ("visible si cualquier parte
de su disco no está tapada"). La misma regla define las horas de **puesta** y
**salida**: buscamos la primera muestra horaria donde cambia el estado e
interpolamos linealmente el borde superior del disco contra el horizonte para
obtener el minuto. Si nada cambia antes de que se acaben los datos, la app dice
"> X (end of data)".

### 4.6 Dibujo 3D

- **Shader del terreno** (`src/scene/terrainShader.ts`): para cada píxel recorre
  las tres mallas de alturas **hacia el Sol** (y hacia la Tierra para la luz de la
  Tierra) y encuentra el ángulo de terreno más alto: el mismo método del horizonte
  que usan las métricas (Mazarico et al. 2011). Eso da **sombras proyectadas
  reales**, suaves en el borde del disco solar. El brillo de la superficie usa la
  reflectancia **lunar-Lambert** (McEwen 1991), estándar en fotometría lunar.
- **Silueta del horizonte** a 300 km más una **línea gris delgada**: muestran el
  horizonte calculado exacto detrás de todo el terreno.
- **Sol**: disco blanco a su tamaño real más un brillo suave. Desde la Luna el Sol
  es blanco (en la Tierra se ve amarillo por nuestra atmósfera).
- **Tierra**: disco sombreado como esfera iluminada desde la dirección real del
  Sol (así la fase sale de la geometría), con la textura Blue Marble de la NASA.
  La orientación usa las direcciones del Sol y la Tierra en los dos sistemas
  (RA/DEC y az/el) para obtener la rotación entre el cielo y el sitio (método
  TRIAD), el polo de la Tierra y la sub-longitud del observador de Horizons. Vista
  desde el polo sur lunar, la Tierra aparece más o menos **con el sur hacia
  arriba** (la Antártida arriba), y eso es correcto.
- Las **etiquetas** son HTML normal que se mueve cada cuadro a la posición 3D
  proyectada.
- El canvas solo se redibuja **cuando algo cambia** y limita la resolución de
  pantalla a 1.5× para ir más rápido.

### 4.7 Tecnologías y por qué

| Elección | Por qué |
|---|---|
| **Vite** (no Next.js) | App 3D del lado del cliente que lee archivos estáticos: no necesita renderizado en servidor ni rutas de API. Next.js solo agregaría límites de "solo cliente" y problemas de hidratación. Se puede publicar como sitio estático (Vercel/Netlify); el asistente de IA agrega una función serverless (`api/chat.ts`). |
| **React 19 + TypeScript** | Contrato de datos tipado, sin `any` (lo revisa `tsc`). |
| **Tailwind CSS 4** | Diseño rápido y consistente. |
| **CesiumJS** | La Orbital view: globo de la Luna, imágenes en tiles que se cargan según el zoom, selección de puntos. Se carga solo para esa vista. |
| **three.js + react-three-fiber + drei** | Control total de la cámara, shaders propios y datos sin internet. |
| **Python** para los datos | numpy, rasterio (lee COGs remotos por partes, incluye GDAL), pyproj (matemática de proyección bien probada). El script de Horizons usa solo la librería estándar. |
| **Archivos estáticos, sin base de datos, sin API en vivo** | Funciona sin internet; todos los cálculos se hacen antes de la demo. |

### 4.8 Orbital view

- **CesiumJS** (carga perezosa, su propio paquete de unos 4 MB) con el elipsoide
  de la Luna (radio 1737.4 km) y sin terreno, así que el globo es liso. El relieve
  solo se muestra con las capas de mapa. Por qué Cesium: carga de tiles según el
  zoom, WMTS y obtener latitud / longitud sin escribirlo a mano.
- **Imágenes**: tiles de NASA Moon Trek (equirectangulares, 256 px, 2 × 1 tiles en
  el nivel 0). El mosaico de fotos LRO WAC es la base; una capa se dibuja encima.
  La lista de capas es un registro (`src/data/layers.ts`) con, por cada producto,
  el nivel de tile más alto real y su caja de cobertura, comprobados contra su
  `WMTSCapabilities.xml` y con peticiones de tiles (el nivel siguiente da 404), así
  que no se piden tiles fuera de los datos.
- **Rendimiento**: dibujo bajo demanda, una sola vista 3D montada a la vez (el
  globo se quita al abrir la Horizon view y al revés), solo los archivos del sitio
  abierto en memoria, vistas previas con archivos chicos.
- La vista previa de Topography es una foto del globo sobre la zona, tomada cuando
  la cámara llega y los tiles están cargados.

### 4.9 Sitios y sus datos

- Los sitios están en `scripts/sites.py` (datos) y `src/data/sites.ts` (app), con
  la fuente de cada coordenada. Cada sitio tiene una carpeta `public/data/<sitio>/`
  con `sky.json`, `horizon.json` y las mallas de terreno.
- **Sitios del polo sur** (Shackleton, Connecting Ridge C1, C2): DEM polar de LOLA
  de 20 m, horizonte a **200 km**, tres mallas (20 m, 320 m, 640 m).
- **Otros sitios** (Apollo 11, 16, 17): DEM global de LOLA de 118 m (USGS), leído
  por bloques de filas, horizonte a **50 km**, mallas de 118 m, 474 m y 948 m. En
  Apollo 11 un horizonte de 50 km es igual al de 200 km (0 de 1440 bins difieren).
  Cerca del polo hacen falta 200 km (problema #14 de PROJECT_MEMORY), así que el
  camino polar los conserva.
- **Sitios CLPS** (Mons Mouton, Malapert A, Schrödinger Basin; vendrán más): el
  mismo camino global de 118 m que Apollo, radio de 50 km. Mons Mouton (-84.6°) y
  Malapert A (-84.1°) no caen dentro del archivo polar de 20 m (cubre latitudes
  -86° y al sur), así que usan el modelo global, estirado en dirección este-oeste,
  y por eso sus archivos son más grandes (unos 30 MB). Las coordenadas salen de las
  páginas CLPS de la NASA con un decimal (unos 3 km), por eso están marcadas *por
  confirmar*. Cerca del polo el terreno a más de 50 km puede importar (problema #14
  de PROJECT_MEMORY): sus porcentajes de Sol pueden ser algo optimistas hasta
  compararlos con un horizonte de 200 km.
- Sol y Tierra: una consulta a Horizons por sitio
  (`fetch_horizons.py --site <id>`), cada hora durante 90 días.
- Un sitio nuevo necesita los dos scripts (`--site <id>`) y una entrada en las dos
  listas de sitios.

### 4.10 Estancia y fecha de llegada

La llegada es la fecha y hora elegidas; la estancia tiene una duración en días (por
defecto 6.5, de NASA lunar site selection 2023; rango de 0.5 a 29.5). La app cuenta
las muestras horarias del rango [llegada, llegada + estancia) con la misma regla de
siempre (alguna parte del disco arriba del terreno). Si la estancia pasa del final de
los datos, dice cuántos días se cuentan en realidad.

### 4.11 Requisitos y mapa de zonas

- **Sitios**: % de Sol y % de enlace con la Tierra de la estancia, y la pendiente en
  el sitio (ajuste de un plano a los nodos de terreno alrededor,
  `scripts/site_slopes.py`: base de 100 m en sitios polares, unos 355 m en Apollo; la
  base siempre se muestra). Valores por defecto: Sol ≥ 100%, Tierra ≥ 25% (el origen
  en NASA de este valor no está verificado), pendiente ≤ 10° (requisito de NASA
  Artemis, escala de unos 100 m).
- **Cuadrícula de zonas** (`scripts/build_zones.py`): un cuadro de 50 × 50 km centrado
  en el polo sur en **celdas de 1 km** (2,500). Por celda guarda la proporción de
  pendiente (% del área con pendiente ≤ 1…30°, base de 100 m, LOLA 20 m) y el horizonte
  de sus **4 puntos más altos de 20 m** (separados al menos 200 m; los bordes y
  crestas reciben más luz, Gläser et al. 2018), 360 bins de azimut, terreno de 20 m a
  2 km, 80 m a 20 km, 160 m a 60 km y 320 m a 200 km. Unos 27 minutos, 7.6 MB.
- **En el navegador** (`src/scene/zones.ts`): el Sol y la Tierra para cualquier punto
  salen de `public/data/ephemeris.json` (puntos subsolar y subterrestre y distancias
  de Horizons, cada hora), que incluye el paralaje de la Tierra (hasta 0.26°). Una
  celda cumple Sol y Tierra si **alguno** de sus puntos cumple. Cumple la pendiente si
  al menos el **20% de su área** está bajo el límite (valor elegido por el equipo, no
  oficial).
- Una celda es mucho más ancha que los mejores puntos (20 a 40 m, Gläser et al. 2018),
  así que esto es tamizaje, no selección de sitio.

### 4.12 Estado de la app y robustez

El tiempo elegido y la duración de la estancia viven en `App` y se comparten entre las
dos vistas; la barra de direcciones los refleja. TypeScript está en modo `strict`. Un
"error boundary" muestra un mensaje en vez de una página en blanco si una vista falla
(por ejemplo, sin WebGL).

### 4.13 Puntaje del Dashboard y Compare

Los dos usan los mismos números (`src/scene/compare.ts`), para la llegada y la
estancia elegidas, con la misma regla de horizonte del resto de la app. Cinco ejes,
cada uno de 0 a 100:

| Eje | Cómo |
|---|---|
| Tiempo con Sol | % de la estancia con parte del Sol sobre el terreno |
| Continuidad del Sol | 100 menos el hueco más largo sin Sol, como parte de la estancia |
| Altura del Sol | elevación media del Sol mientras es visible; 30° cuenta como 100 |
| Tiempo con la Tierra | % de la estancia con parte de la Tierra sobre el terreno |
| Planicie | 100 a 0°, 0 a 10° (el límite de pendiente de HLS); se omite si el sitio no tiene pendiente |

Un objetivo es un conjunto de pesos (Power: Sol .45, continuidad .35, altura .1,
planicie .1; Communications: Tierra .8; Safe landing: planicie .5; Balanced: todos
los ejes). El puntaje es el promedio ponderado de los ejes que tienen dato. **Los
pesos y el tope de 30° son una primera propuesta, no números de misión validados.**
Las líneas de tiempo se guardan en caché por sitio cargado y la hora de llegada se
halla por índice (los datos son cada hora), así el Dashboard se recalcula rápido. Los
puntajes son solo tamizaje.

## 5. Datos y fuentes

| Dato | Fuente | Notas |
|---|---|---|
| Coordenadas del sitio | Gläser et al. 2018, *Planetary and Space Science* 162, 170–178, Tabla 1 (Shackleton, a nivel del suelo, "this study"), doi:10.1016/j.pss.2017.07.006 | -89.7849°, 203.97° E (latitud sur, confirmada por Vanessa en el PDF). |
| Referencia del cráter | USGS Gazetteer of Planetary Nomenclature, Shackleton (Feature 5450) | Centro -89.67°, 129.78° E, diámetro 20.92 km. Solo se usa como comprobación. |
| Sol y Tierra | API de NASA/JPL Horizons (`ssd.jpl.nasa.gov/api/horizons.api`) | Las respuestas originales se guardan en `data/raw/`. |
| Terreno | LOLA LDEM_80S_20MPP_ADJ, NASA PGDA producto 90, Barker et al. 2023, *Planet. Sci. J.* 4, 183, doi:10.3847/PSJ/acf3e1 | Se lee a distancia por partes. |
| Revisión de resolución efectiva | LDEM_80S_20MPP_ADJ_EFFRES (mismo producto) | Mediana de 16 m a menos de 10 km del sitio. |
| Imagen de la Tierra | NASA Blue Marble Next Generation con topografía y batimetría, diciembre 2004 (`world.topo.bathy.200412.3x5400x2700.jpg`), dominio público | Reducida a 2048 × 1024. |
| Referencias de validación | Gläser et al. 2018; app web de Horizons; Mazarico et al. 2011 (*Icarus* 211, método); McEwen 1991 (lunar-Lambert) | Ver abajo. |

Altura del observador **2 m** (altura de los paneles solares de un módulo, como en
Gläser et al. 2018). Altitud del sitio en Horizons **0 km** sobre la esfera
(supuesto: unos km de diferencia cambian la dirección del Sol y la Tierra de forma
despreciable).

**Agregado después de la primera versión (2026-11-14)**

| Dato | Fuente | Notas |
|---|---|---|
| Connecting Ridge C1 y C2 | Gläser et al. 2018, Tabla 2 (a 2 m del suelo): C1 -89.4398°, 222.83° E; C2 -89.3130°, 245.98° E | La Tabla 3 lista los clusters C1-0, C1-1, C2-0, C2-1 sin coordenadas, así que no se usan. Valores leídos del texto del PDF; confirmar en el PDF. |
| Apollo 11, 16, 17 | NSSDC *Apollo Landing Site Coordinates* (módulo lunar), Wagner et al. 2017, Icarus 283, 92-103 | Planetocéntricas, Mean Earth/Polar Axis, DE421. |
| Terreno lejos del polo | DEM global de LOLA de 118 m (USGS Astrogeology, `Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014`) | Leído por bloques de filas, sin descarga completa. |
| Mapas de la Orbital view | Tiles WMTS de NASA Moon Trek: mosaico LRO WAC, hillshade y hillshade en color de LOLA, pendiente LOLA/Kaguya, sombreado LOLA 5 m del polo sur, temperatura Diviner | No se encontraron los términos de uso de Moon Trek; se muestra con crédito. |
| Sol/Tierra para cualquier punto | Tabla de Horizons de la Luna vista desde la Tierra (`ephemeris.json`) | Puntos subterrestre y subsolar y distancias. |
| Pendiente en los sitios | Calculada de nuestros archivos de terreno (`site_slopes.json`) | La base se muestra con cada valor. |

## 6. Validación

Todas las pruebas son scripts que se pueden volver a correr.

| Prueba | Resultado | Script / archivo |
|---|---|---|
| Nuestros datos de Horizons vs la **app web de Horizons** (llenada a mano, mismo sitio y horas) | 25 filas, diferencia máxima **0.0°** en azimut y elevación | `scripts/compare_horizons_web.py`, `data/validation/horizons_web_earth_2026-11-14.txt` |
| **Luz solar a 20 años** en el sitio vs **Gläser et al. 2018 Tabla 1** (2017–2037, Horizons cada 6 h + nuestro horizonte) | A nivel del suelo: iluminación promedio **79.1%** vs 81.0%, visibilidad solar **83.9%** vs 85.5%. A 2 m: 83.5% / 88.2% (más alto, como dice el paper) | `scripts/check_illumination.py`, `data/validation/illumination_check.json` |
| **Método de sombras 3D** (algoritmo del shader en CPU) vs perfil de horizonte | Mediana **0.07°**, p95 0.23°, máximo 0.34°. Misma decisión visible/oculto: Sol **709/709**, Tierra **706/709** (3 casos en el borde) | `scripts/check_shadow_method.py` |
| Horas de salida/puesta en la app vs Python independiente | Mismas horas (por ejemplo, la Tierra se oculta el 1 de dic a las 02:34 UTC), enlace con la Tierra 50% vs 49.8% | revisado durante el desarrollo |
| Proyección del mapa | Sitio → mapa → sitio regresa -89.7849°, 203.97°; distancia al polo 6522.56 m vs Horizons 6.52254 km | revisado durante el desarrollo |
| El sitio está en el borde | A 10.35 km del centro del cráter de la USGS; radio de la USGS 10.46 km | revisado durante el desarrollo |
| **Fase de la Tierra** por geometría vs Illu% de Horizons | Diferencia máxima **0.13 puntos** en el periodo | revisado durante el desarrollo |
| **Orientación de la Tierra** vs Horizons | Sub-latitud del observador dentro de 0.25°; **punto subsolar** dentro de 0.19° en longitud / 0.26° en latitud en 60 momentos | revisado durante el desarrollo |

Los valores de Gläser (81.0%, 85.5%) se leyeron del texto del PDF; hay que
confirmarlos en la Tabla 1, página 4 del paper.

**Agregado después de la primera versión (2026-11-14)**

| Prueba | Resultado | Script / archivo |
|---|---|---|
| Connecting Ridge, 20 años vs **Gläser Tabla 2** (2 m) | C1: iluminación **87.56%** vs 88.0%, visibilidad solar **91.8%** vs 92.1%. C2: **77.87%** vs 78.1%, **81.82%** vs 82.0% | `check_illumination.py --site <id>`, `data/validation/` |
| Sol/Tierra para **cualquier punto** vs las tablas por sitio de Horizons | Dentro de **0.006°** en Shackleton, C1, C2, Apollo 11 y 17 | `fetch_ephemeris.py` |
| Porcentajes de la estancia vs un conteo independiente (Shackleton, 6.5 días) | Llegada 14 nov: 62.8%; 28 nov: 48.1%; 30 nov: 17.3%; 2 dic: 0% (Sol 100%) | revisado con un conteo aparte en Python |
| Horizontes de zona vs los horizontes de 20 m ya validados | Máx **0.23°**, percentil 95: 0.10° (3 sitios del polo sur) | `build_zones.py --check` |
| Celdas de zona vs los sitios que contienen | Celda del borde de Shackleton Sol 100% / Tierra 48.7% (sitio 100% / 48%); celdas de C1 y C2 iguales a los sitios | revisado en el navegador |
| Horizonte a 50 km vs 200 km lejos del polo | 0 de 1,440 bins difieren en Apollo 11 (un mar plano; no probado en tierras altas) | medición |
| Datos de 90 días vs el primer mes | Las primeras 709 muestras son idénticas (0.0°) | revisado al extender |

## 7. Datos reales vs ayudas visuales

**La app no tiene datos de ejemplo (dummy).** Al principio hubo datos de cielo de
ejemplo y un terreno falso, solo en los primeros pasos de construcción, y ya se
borraron. Cada número de la barra lateral sale de Horizons + LOLA.

Algunas cosas se dibujan distinto a la realidad **solo para que se puedan ver**.
También están en los créditos de la app:

| Ayuda visual | Por qué |
|---|---|
| La luz de la Tierra sobre el terreno está aumentada | La luz real de la Tierra es demasiado débil al lado de la luz del Sol. Usa la dirección y la fase reales de la Tierra. |
| El suelo en sombra se aclara a gris oscuro (no negro) | Para que el terreno nunca se confunda con el cielo negro. |
| Línea gris delgada sobre el horizonte calculado | Marca dónde termina el suelo y empieza el cielo. |
| El lado de noche de la Tierra muestra los continentes al 45% de brillo | El lado de noche real es oscuro; así la Tierra se sigue viendo y la fase se nota. |
| Brillo suave alrededor del Sol | El disco en sí tiene el tamaño real. |
| Zoom | Solo cambia el campo de visión (como binoculares); el indicador muestra el FOV y el aumento. Los cuerpos nunca se agrandan. |

**Agregado después de la primera versión (2026-11-14)**

| Ayuda visual | Por qué |
|---|---|
| Los mapas del globo son fotos y mapas de color, no mediciones | Su iluminación es parte de la imagen y no sigue la fecha. Hillshade tiene una dirección de luz fija. |
| Celdas de zona en verde / gris | Un resumen de los requisitos para tamizar, no un mapa de seguridad. |
| El Horizon preview dibuja el Sol y la Tierra como puntos pequeños | Es una vista rápida, sin escala (el Sol mide 0.5° y la Tierra 1.8°). |
| Los colores de las capas no tienen escala de valores | Moon Trek no la da para estos tiles, así que no se inventa. |

## 8. Limitaciones conocidas

- **Sitios y periodo.** Nueve sitios elegidos y 90 días (2026-11-14 a 2027-02-12).
  Las misiones sin punto de alunizaje (Peregrine, que no aterrizó; Blue Moon
  Pathfinder, "región polar sur"; Blue Ghost 2, cara oculta y órbita) van en una
  nota, no en el mapa. Mare Crisium, Reiner Gamma y Gruithuisen Domes tienen
  coordenadas pero sus datos aún no están generados.
  Todavía no hay coordenadas personalizadas: un sitio nuevo necesita los scripts de
  Python, porque los navegadores no pueden leer LOLA ni Horizons directamente (sin
  CORS).
- **Mapa de zonas.** Solo el polo sur, en un cuadro de 50 × 50 km, celdas de 1 km,
  juzgadas en los 4 puntos más altos de cada celda. La pendiente usa una base de
  100 m de LOLA 20 m. La regla del 20% del área y el umbral del 25% de Tierra son
  valores del equipo, no oficiales. Lejos del polo no hay mapa de zonas.
- **Los sitios Apollo** usan terreno de 118 m y radio de 50 km, probado contra 200 km
  solo en Apollo 11. Sus horizontes todavía no se comparan con una fuente
  independiente (Quickmap).
- **La Orbital view** necesita internet para los tiles y no se pudieron encontrar sus
  términos de uso (se muestra el crédito). La capa de fotos se ve mal en el polo sur
  (los tiles equirectangulares se estiran ahí); Hillshade y Elevation usan el modelo
  polar de 5 m. No hay leyendas con valores, y el mapa de temperatura nocturna se ve
  grueso y tiene una costura.
- **La pendiente** depende de la escala de medición; los valores con bases distintas
  no son comparables.

- **El suelo cercano se ve liso.** La resolución efectiva de LOLA cerca del sitio
  es de unos 16 m: no puede mostrar rocas ni cráteres pequeños. Es un límite de
  los datos.
- **Se ignora el terreno a más de 200 km** (horizonte y sombras).
- **Regla del disco con línea recta**: la visibilidad parcial trata el horizonte
  como recto sobre el disco.
- **"Cualquier parte visible" es un poco optimista para enlaces de radio** (PGDA
  dice lo mismo); no se modelan presupuestos de enlace, máscaras de antena ni la
  visibilidad de las estaciones de la DSN.
- **Muestras cada hora**; las horas de salida/puesta se interpolan (precisión de
  minutos, no exacta).
- Altitud del sitio en Horizons 0 km; observador a 2 m; sin modelo térmico; la
  energía solo es "Sol visible", no watts.
- La orientación de la Tierra usa el eje z del ICRF como polo de la Tierra
  (precesión desde J2000 ≈ 0.4°, imperceptible a este tamaño); la fase por
  geometría ignora el paralaje del Sol (error ≤ 0.13 puntos).
- La búsqueda de alturas para las sombras 3D usa un mapa afín cuyo error crece con
  la distancia (por la curvatura, el terreno profundo y lejano se "inclina"); la
  textura de alturas se re-muestrea para compensarlo, y la prueba de arriba
  muestra que el efecto es pequeño.
- **Todavía no se valida contra Quickmap / Moon Trek** (planeado).
- Rendimiento: ~19 MB de datos de terreno; el JS pesa ~1.1 MB (three.js).
- Python en macOS instalado desde python.org puede no traer certificados SSL (ver
  sección 12).

## 9. Opciones descartadas

| Opción | Por qué no (por ahora) |
|---|---|
| **Cesium Moon 3D Tiles** | Se ve muy bien, pero usa otro terreno (se reporta una diferencia de ~2.5 km contra LOLA, sin verificar), así que la vista podría contradecir nuestros números validados; las imágenes traen sombras "pintadas" que no se mueven con la fecha; necesita internet y un token de Cesium ion durante la demo; implicaría rehacer la vista 3D. Podría ser después una vista aparte de globo. |
| **Next.js** | No se necesitan funciones de servidor (ver 4.7). |
| **Llamadas a APIs desde el navegador** | La demo debe funcionar sin internet; Horizons no documenta CORS. |
| **Descargar el mosaico de 5 m (3.3 GB)** | No hace falta: el COG de 20 m se lee por partes. Más adelante se puede agregar un parche de 5 m cerca de la cámara (ese archivo también está dividido en bloques). |
| **Solo datos de 240 m (el antiguo "Plan B")** | El terreno grueso sobreestima la luz (Gläser et al. 2018) y los puntos buenos miden solo 20–40 m de ancho. |
| **Shadow maps de three.js** | Fallan con el Sol a 1–2° sobre el horizonte; nuestro shader usa el método del horizonte. |
| **lhorizon / astroquery / SpiceyPy** | No hicieron falta: la API de Horizons con la librería estándar alcanzó y está validada. |
| **astronomy-engine en el navegador** | Precisión de ~1 minuto de arco; útil después para coordenadas personalizadas, no para números validados. |
| **Imágenes de Moon Trek** | No tienen términos de uso publicados; CORS sin confirmar. |
| **Dibujar la Tierra más grande que la real** | Mentiría sobre el tamaño y sobre cuándo se tapa detrás del terreno; en su lugar se usa el zoom. |
| **Sol amarillo** | Desde la Luna el Sol es blanco. |
| **Etiquetas `Html` de drei** | Se perdían etiquetas con React 19 en desarrollo; se reemplazaron por etiquetas propias proyectadas. |
| Algunos enlaces de la investigación de un compañero | Eran copias en vez de las fuentes originales (por ejemplo, un enlace de `lhorizon` en un dominio de redirección, una copia de la USGS en Mintlify, copias de la documentación de astronomy-engine). Usar las fuentes oficiales. |

**Agregado después (2026-11-14)**

| Opción | Estado |
|---|---|
| Llamar a Horizons / LOLA desde el navegador para coordenadas personalizadas | No es posible sin CORS. Haría falta un servidor pequeño (pospuesto para después del pitch). |
| Kernels SPICE para las efemérides | No hacen falta: una tabla de Horizons más geometría coincide con Horizons a 0.006°. |
| Tiles 3D de la Luna de Cesium | Siguen descartados. El globo usa la librería CesiumJS con tiles de Moon Trek sobre una esfera lisa. |
| Imágenes del CGI Moon Kit para el globo | Se eligieron los tiles de Moon Trek (más nítidos, toda la Luna, misma fuente NASA). |

## 10. Siguientes pasos

Prioridad para el pitch:

1. Validar los horizontes (incluidos los de Apollo) contra **Quickmap / Moon Trek** en
   los mismos sitios.
2. Grabar un **video de respaldo** del demo (Orbital view → sitio → Horizon view →
   cambiar la fecha → requisitos y zonas).
3. Revisar los umbrales con sus documentos de NASA (Tierra ≥ 25%, pendiente 10°) y
   los términos de uso de Moon Trek.
4. Preparar respuestas: por qué estos datos, qué tan exactos, qué falta, por qué es
   mejor que Quickmap/Horizons (un solo lugar, mismos datos para la imagen y los
   números, validado).

Después:

- **Zonas para toda la Luna**: celdas de 1° con Sol y Tierra por geometría (sin
  sombras de terreno, con la etiqueta que lo dice). Una pendiente global necesitaría
  un DEM global (decisión pendiente: omitir la pendiente o usar una gruesa).
- **Coordenadas personalizadas** con un servidor pequeño que corra el pipeline de
  Python.
- **Puntajes de requisitos** (deseables con pesos, presets por tipo de módulo).
- **KPIs de impacto** del Dashboard (horas o dinero ahorrados) a partir de la
  investigación del equipo del proceso de hoy; el Dashboard ya está construido, las
  tarjetas de KPI siguen en `—` hasta entonces.
- **Asistente de IA**: construido (herramientas sobre los datos de la app,
  revisión estricta de números, entrada por voz), aún sin probar con un modelo
  real; correr el set de pruebas cuando exista la llave.
- **Compare**: revisar con el equipo los pesos por objetivo y el tope de 30° de
  altura del Sol; comparar los horizontes de los nuevos sitios CLPS (50 km) contra
  uno de 200 km; confirmar las coordenadas CLPS en las páginas de NASA; generar Mare
  Crisium, Reiner Gamma y Gruithuisen Domes; un formato de terreno más pequeño
  (guardar solo alturas, unas 3 a 6 veces menos).
- Una línea de tiempo del día lunar, una gráfica 2D del horizonte, celdas de zona
  más finas (500 m, unas 4 veces más lento).
- El plan completo por fases y sus resultados están en [`docs/PLAN.md`](docs/PLAN.md).

## 11. Estructura del proyecto

```
concorde/
├── README.md                 versión en inglés (referencia)
├── README.es.md              este archivo
├── docs/PROJECT_MEMORY.md    historia completa del proyecto y sus decisiones
├── docs/PLAN.md              plan de construcción por fases, con el resultado de cada una
├── reference-image.jpeg      imagen de referencia de la idea (paper externo, no se usa como dato)
├── index.html                cabecera de la página: título, descripción, vista previa para redes, datos estructurados
├── api/                      función serverless del asistente de IA (chat.ts, _lib/)
├── vite.config.ts, tsconfig*.json, package.json
├── public/
│   ├── data/<sitio>/         sky.json, horizon.json, terrain.json, terrain_*.f32 (9 sitios)
│   ├── data/zones/           south-pole-1km*.{json,bin}: celdas, horizontes, pendiente
│   ├── data/ephemeris.json   Sol/Tierra para cualquier punto, cada hora
│   ├── data/site_slopes.json pendiente en cada sitio
│   ├── textures/             mapa de la Tierra, stars/ y stars-h/ (mapa de estrellas Tycho-2), moon-hero.png
│   └── og-image.jpg, favicon.svg, apple-touch-icon.png, robots.txt, sitemap.xml
├── data/
│   ├── raw/                  respuestas crudas de Horizons (evidencia)
│   └── validation/           exportación de la web de Horizons, pruebas de luz a 20 años
├── scripts/                  Python: generación y validación de datos
│   ├── sites.py              sitios elegidos (usa --site <id>)
│   ├── fetch_horizons.py     Sol/Tierra de Horizons -> sky.json
│   ├── build_terrain.py      LOLA -> horizon.json + mallas de terreno
│   ├── build_zones.py        celdas de zona alrededor del polo sur
│   ├── fetch_ephemeris.py    Sol/Tierra para cualquier punto -> ephemeris.json
│   ├── site_slopes.py        pendiente en cada sitio -> site_slopes.json
│   ├── compare_horizons_web.py, check_illumination.py, check_shadow_method.py
│   └── requirements.txt
└── src/
    ├── App.tsx               vistas, tiempo y estancia compartidos, estado en la barra de direcciones, carga perezosa
    ├── types.ts              contrato de datos (todo tipado, sin `any`)
    ├── data/                 loadSiteData.ts (archivos estáticos), sites.ts (sitios y misiones CLPS), kpis.ts (marcadores de KPIs de impacto), layers.ts (capas del mapa)
    ├── state/                urlState.ts (?view=&site=&t=&stay=&cmp=), scenarios.ts (escenarios de Compare)
    ├── assistant/            panel del asistente de IA, herramientas, revisión de números (ver docs/AI_ASSISTANT_PLAN.md)
    ├── scene/                lógica pura
    │   ├── visibility.ts, windows.ts, timing.ts   horizonte, salida/puesta, %
    │   ├── stay.ts           porcentajes de la estancia
    │   ├── compare.ts, dashboard.ts   cinco ejes y puntaje por objetivo; Sol diario para el mapa de calor
    │   ├── requirements.ts   requisitos por sitio
    │   ├── zones.ts          celdas de zona: Sol/Tierra para cualquier punto, requisitos
    │   ├── timeSelection.ts, terrainInfo.ts, formatTime.ts, skyMath.ts, constants.ts, viewLimits.ts
    │   └── terrainGrid.ts, terrainShader.ts, earthOrientation.ts   3D de la Horizon view
    └── components/           componentes de React (cada uno con un trabajo)
        ├── NavRail, ErrorBoundary, FlagButton, MissionList
        ├── Dashboard: DashboardTab. Compare: CompareTab (tarjetas, radar)
        ├── Orbital view: MoonGlobe, LayerSelector, SitePanel, HorizonPreview,
        │   StayPanel, RequirementsPanel, zoneLayer
        └── Horizon view: SiteView, Sidebar, MetricsPanel, DateTimeControl, StatusBadge,
            PeriodSummary, Credits, MainView (Terrain, SunDisc, EarthDisc, ...)
```

Git: se trabaja en `stage`; `main` recibe `stage` cuando está lista.

## 12. Regenerar los datos

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
```

Para un sitio (por defecto `shackleton-rim`; los ids están en `scripts/sites.py`, por
ejemplo `connecting-ridge-c1`, `apollo-17`):

```bash
python3 scripts/fetch_horizons.py --site apollo-17
```

```bash
.venv/bin/python scripts/build_terrain.py --site apollo-17
```

Datos compartidos y mapa de zonas:

```bash
python3 scripts/fetch_ephemeris.py
```

```bash
.venv/bin/python scripts/build_zones.py
```

```bash
.venv/bin/python scripts/site_slopes.py
```

Validación:

```bash
python3 scripts/compare_horizons_web.py
```

```bash
.venv/bin/python scripts/check_illumination.py --site connecting-ridge-c1
```

```bash
.venv/bin/python scripts/check_shadow_method.py
```

Para cambiar el periodo, edita `START_UTC` y `STOP_UTC` en `fetch_horizons.py` y
`fetch_ephemeris.py` y córrelos para cada sitio. Para agregar un sitio, agrégalo a
`scripts/sites.py` y a `src/data/sites.ts`, y corre los dos comandos del sitio.
`build_zones.py` tarda unos 27 minutos (agrega `--cells 20` para medirlo y `--check`
para compararlo con los horizontes de los sitios).

**Error de SSL en macOS** (`CERTIFICATE_VERIFY_FAILED`, común con el instalador
de python.org): exporta los certificados de confianza de macOS y úsalos en
Python/GDAL solo para esa ejecución.

```bash
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain /Library/Keychains/System.keychain > /tmp/macos-ca.pem
```

```bash
SSL_CERT_FILE=/tmp/macos-ca.pem CURL_CA_BUNDLE=/tmp/macos-ca.pem .venv/bin/python scripts/build_terrain.py
```

El servidor de PGDA a veces responde **403** cuando recibe muchas peticiones por
partes seguidas; los scripts de terreno reintentan solos.

## 13. Créditos

- NASA/JPL Horizons (Solar System Dynamics Group).
- DEM de LOLA: Barker et al. 2023, NASA Goddard PGDA.
- Referencia del sitio y de la luz solar: Gläser et al. 2018.
- Método del horizonte: Mazarico et al. 2011. Lunar-Lambert: McEwen 1991.
- Imagen de la Tierra: NASA Earth Observatory, Blue Marble Next Generation.
- USGS Gazetteer of Planetary Nomenclature.
- Mapas de la Orbital view: NASA Moon Trek (mosaico LRO WAC; hillshade, hillshade en
  color y pendiente de LOLA con Kaguya; modelo LOLA de 5 m del polo sur; temperatura
  Diviner). CesiumJS (Apache 2.0).
- DEM global de LOLA de 118 m: USGS Astrogeology. Coordenadas de Apollo: NASA NSSDC,
  Wagner et al. 2017.
- Imagen de referencia de la idea: un paper externo que dio Vanessa, usado solo
  como inspiración visual (no como dato, y no es parte de este reto).

La NASA no respalda este proyecto. Respeta los términos de uso de cada fuente.
