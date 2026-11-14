# Lunar Landing Site Simulator

[English](README.md) · **Español**
(Si alguna vez las dos versiones no coinciden, la versión en inglés es la referencia).

Una vista 3D en primera persona desde un sitio de alunizaje en el polo sur de la
Luna. Muestra dónde están el **Sol** (energía) y la **Tierra** (comunicación
directa) en el cielo a cualquier hora, y si el **terreno real** los tapa.

Hecho para el **NASA Space Apps Challenge 2026**, reto *"Lunar Landing Site
Simulator"*. Sitio actual: **borde del cráter Shackleton**. Periodo actual: un
día lunar, **del 2026-11-14 00:00 al 2026-12-13 12:00 UTC**, cada hora.

> **Herramienta de apoyo para planear, no de grado de vuelo** ("Planning aid,
> not flight grade"). Cada número sale de datos públicos de la NASA y está
> comparado con una fuente independiente (ver [Validación](#6-validación)), pero
> es una herramienta de hackathon, no software de misión.

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

**Nuestro enfoque:** un sitio bien hecho. Una vista en primera persona donde lo
que *ves* (el terreno tapando la Tierra) y lo que *dicen* los números salen de
los mismos datos de la NASA, y cada número está validado.

## 2. Qué hace la app

**Barra lateral (blanca)**

- **Site**: nombre y coordenadas (borde de Shackleton, -89.7849°, 203.97° E).
- **Date and time (UTC)**: campo de fecha más un deslizador sobre 709 muestras
  horarias.
- **Sun (power)** y **Earth (direct link)**, cada uno con:
  - **Status**: ● Visible, ◐ Partly hidden (con el % del disco visible),
    ○ Hidden.
  - **Sunset/Earthset in** (o **rise in** si está oculto): tiempo restante y hora
    UTC exacta, interpolada al minuto.
  - **Elevation**, **Azimuth** y **Terrain horizon there** (qué tan alto está el
    terreno en esa dirección, para que el estado se entienda).
  - Solo para la Tierra: **Lit fraction** (fase de la Tierra vista desde el sitio).
- **Resumen del periodo**: % del periodo con Sol y con enlace a la Tierra.
- **Créditos** y la nota "Planning aid, not flight grade".

**Área principal (vista 3D)**

- Cámara en primera persona, a 2 m del suelo (altura de un módulo de aterrizaje).
  La cámara nunca se mueve de lugar; solo miras alrededor.
- **Arrastra** para mirar alrededor; **rueda del mouse / pellizco** o
  **− / +** para hacer zoom (campo de visión de 60° a 2°); botones
  **Look at Sun / Look at Earth**.
- Terreno real de LOLA hasta 200 km, con **sombras proyectadas reales**.
- El disco del Sol y el de la Tierra a su **tamaño angular real** según Horizons.
  La Tierra muestra su **fase real** y el lado de la Tierra que de verdad mira a
  la Luna (imagen Blue Marble de la NASA).
- Brújula (rumbo en grados), etiquetas "Sun"/"Earth" con "(partial)" u
  "(hidden)", y una línea gris delgada sobre el horizonte calculado.

**Ejemplo (historia para el pitch):** en el borde de Shackleton el Sol está
visible el 100% de este periodo. La Tierra está visible cerca del 50%; el
2026-11-17 a las 00:00 UTC está tapada a la mitad por una cresta (52% del disco
visible), y la siguiente pérdida de comunicación directa es el 2026-12-01 a las
02:34 UTC. El 2026-11-17 a las 12:00 la Tierra se ve aunque está a -0.40° de
elevación, porque desde el borde alto el terreno baja hasta unos -1.35° en esa
dirección; una herramienta con horizonte plano diría que está oculta.

## 3. Cómo correrla

Requisitos: **Node.js** (probado con v25.2.1, npm 11.9.0).

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Todos los datos ya están en `public/data`, así que
la app funciona **sin internet**. La primera carga lee unos 19 MB de datos de
terreno.

Otros comandos:

```bash
npm run build    # revisión de tipos (no se permite `any`) + build de producción en dist/
npm run lint     # oxlint
npm run preview  # sirve el build de producción
```

Los scripts de Python solo se necesitan para **regenerar** los datos
(ver [sección 12](#12-regenerar-los-datos)).

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
| **Vite** (no Next.js) | App 3D del lado del cliente que lee archivos estáticos: no necesita renderizado en servidor ni rutas de API. Next.js solo agregaría límites de "solo cliente" y problemas de hidratación. Se puede publicar como sitio estático (Vercel/Netlify). |
| **React 19 + TypeScript** | Contrato de datos tipado, sin `any` (lo revisa `tsc`). |
| **Tailwind CSS 4** | Diseño rápido y consistente. |
| **three.js + react-three-fiber + drei** | Control total de la cámara, shaders propios y datos sin internet. |
| **Python** para los datos | numpy, rasterio (lee COGs remotos por partes, incluye GDAL), pyproj (matemática de proyección bien probada). El script de Horizons usa solo la librería estándar. |
| **Archivos estáticos, sin base de datos, sin API en vivo** | Funciona sin internet; todos los cálculos se hacen antes de la demo. |

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

## 8. Limitaciones conocidas

- **Un solo sitio y un solo día lunar** (2026-11-14 a 2026-12-13). Todavía no hay
  coordenadas personalizadas.
- **El periodo de datos es corto.** En este periodo el Sol nunca se pone en este
  sitio (es verano en el sur); la prueba de 20 años muestra cerca de 16% del tiempo
  sin Sol.
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

## 10. Siguientes pasos

Prioridad para el pitch:

1. Validar el horizonte contra **Quickmap / Moon Trek** en el mismo sitio.
2. Grabar un **video de respaldo** de la demo.
3. Preparar respuestas: por qué estos datos, qué tan precisos son, qué falta, por
   qué es mejor que Quickmap/Horizons (una sola vista, los mismos datos para la
   imagen y los números, todo validado).

Después del MVP (del reto y del brief):

- **Modo comparar**: dos sitios o dos fechas lado a lado, con la misma dirección
  de cámara.
- **Más sitios**: Connecting Ridge C1/C2 (Gläser et al. 2018 Tabla 1), regiones
  candidatas de Artemis III, objetivos de CLPS; coordenadas personalizadas.
- **Línea de tiempo** de un día lunar; periodos más largos (estaciones, el ciclo de
  18.6 años).
- **Gráfica 2D del horizonte** (perfil del terreno + recorridos del Sol y la
  Tierra) con los mismos datos.
- **Parche de terreno de 5 m** cerca de la cámara.
- Validación contra los **mapas de visibilidad de la Tierra e iluminación de
  PGDA** (producto 69, Mazarico et al. 2011).
- Modo para educadores; publicarlo como sitio estático.

## 11. Estructura del proyecto

```
concorde/
├── README.md                 este archivo en inglés (referencia)
├── README.es.md              este archivo
├── docs/PROJECT_MEMORY.md    historia completa del proyecto y decisiones (inglés)
├── reference-image.jpeg      imagen de referencia de la idea (paper externo, no se usa como dato)
├── index.html, vite.config.ts, tsconfig*.json, package.json
├── public/
│   ├── data/shackleton-rim/  sky.json, horizon.json, terrain.json, terrain_*.f32
│   └── textures/             earth_bmng_topo_bathy_200412_2048.jpg
├── data/
│   ├── raw/                  respuestas originales de Horizons (evidencia)
│   └── validation/           exportación de la web de Horizons, prueba de luz a 20 años
├── scripts/                  Python: generación de datos y validación
│   ├── fetch_horizons.py     Sol/Tierra desde Horizons -> sky.json
│   ├── build_terrain.py      LOLA -> horizon.json + mallas de terreno
│   ├── compare_horizons_web.py
│   ├── check_illumination.py
│   ├── check_shadow_method.py
│   └── requirements.txt
└── src/
    ├── App.tsx               carga los datos, muestra carga/error, dibuja SiteView
    ├── types.ts              contrato de datos (todo tipado, sin `any`)
    ├── data/loadSiteData.ts  capa de datos delgada: lee y valida los archivos estáticos
    ├── scene/                lógica pura: geometría, visibilidad, tiempos, shaders
    │   ├── constants.ts      altura del observador, ejes
    │   ├── skyMath.ts        az/el -> dirección, tamaño del disco
    │   ├── visibility.ts     búsqueda en el horizonte, fracción del disco, estado
    │   ├── windows.ts        horas de salida/puesta, % visible
    │   ├── timing.ts         tipo de las métricas de tiempo
    │   ├── formatTime.ts     formato de UTC y duraciones
    │   ├── terrainGrid.ts    geometría + texturas de alturas desde las mallas
    │   ├── terrainShader.ts  sombras + sombreado lunar-Lambert (GLSL)
    │   ├── earthOrientation.ts  polo de la Tierra / sistema del sub-observador (TRIAD)
    │   └── viewLimits.ts     límites del zoom
    └── components/           componentes de React (uno por tarea)
        ├── SiteView.tsx      selección de tiempo compartida, barra lateral + vista 3D
        ├── Sidebar.tsx, DateTimeControl.tsx, MetricsPanel.tsx,
        │   StatusBadge.tsx, PeriodSummary.tsx, Credits.tsx
        └── MainView.tsx      Canvas: Terrain, HorizonSilhouette, SunDisc,
            EarthDisc, ScreenLabels, LookControls, CompassOverlay, ViewControls
```

Git: se trabaja en `stage`; `main` recibe lo de `stage` cuando está listo.

## 12. Regenerar los datos

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
```

```bash
python3 scripts/fetch_horizons.py
```

```bash
.venv/bin/python scripts/build_terrain.py
```

Validación:

```bash
python3 scripts/compare_horizons_web.py
```

```bash
.venv/bin/python scripts/check_illumination.py
```

```bash
.venv/bin/python scripts/check_shadow_method.py
```

Para cambiar el sitio o el periodo, edita `SITE`, `START_UTC` y `STOP_UTC` en
`fetch_horizons.py` y las constantes del sitio en `build_terrain.py`, y luego
corre los dos.

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
- Imagen de referencia de la idea: un paper externo que dio Vanessa, usado solo
  como inspiración visual (no como dato, y no es parte de este reto).

La NASA no respalda este proyecto. Respeta los términos de uso de cada fuente.
