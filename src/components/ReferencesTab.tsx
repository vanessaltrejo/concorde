import type { ReactNode } from 'react'
import { LAYERS, SELECTOR, tileLimitLabel } from '../data/layers'
import { CLPS_WITHOUT_SITE, SITES } from '../data/sites'

// The one place where every source, method and limit is written down. The rest
// of the app does not repeat them. Each entry says what it is and what it is
// used for in this app.

type Ref = { name: string; link?: string; usedFor: string }

const DATA: Ref[] = [
  {
    name: 'NASA/JPL Horizons API: Sun and Earth seen from the Moon (observer on the Moon, airless)',
    link: 'https://ssd.jpl.nasa.gov/horizons/',
    usedFor:
      'Azimuth, elevation, angular size and Earth phase for every site and date. Points picked on the map use one table for the whole Moon (checked against the per-site tables within 0.006°; Earth picture orientation taken from the Shackleton rim table, parallax up to about 0.3°, visual only).',
  },
  {
    name: 'LRO LOLA terrain: polar 20 m product LDEM_80S_20MPP_ADJ (PGDA 90), Barker et al. 2023, Planet. Sci. J. 4, 183',
    link: 'https://doi.org/10.3847/PSJ/acf3e1',
    usedFor: 'Terrain, horizon and cast shadows of the south pole sites in the Horizon view (20 m near the observer).',
  },
  {
    name: 'LRO LOLA Global LDEM 118 m (Mar 2014), USGS Astrogeology',
    link: 'https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m',
    usedFor: 'Terrain, horizon and shadows for the other sites and for any point picked on the map (tiles loaded and computed in your browser).',
  },
  {
    name: 'NASA Blue Marble Next Generation with topography and bathymetry (December 2004)',
    link: 'https://visibleearth.nasa.gov/collection/1484/blue-marble',
    usedFor: 'The picture of the Earth in the sky, oriented with the Horizons sub-observer point.',
  },
  {
    name: 'Tycho-2 star map (cube map)',
    link: 'https://svs.gsfc.nasa.gov/',
    usedFor: 'The star background of the Horizon view.',
  },
  {
    name: 'NASA Moon Trek (LRO products served as tiles)',
    link: 'https://trek.nasa.gov/moon/',
    usedFor: 'Every layer of the Orbital view and the Moon image of the Dashboard. Details per layer below.',
  },
]

const METHODS: Ref[] = [
  {
    name: 'Mazarico et al. 2011, Icarus 211: illumination of the lunar polar regions using LOLA topography',
    link: 'https://doi.org/10.1016/j.icarus.2010.11.012',
    usedFor: 'Terrain horizon method: horizon and shadows are the highest terrain angle along each azimuth. A body counts as partly hidden when terrain covers part of its disc; set and rise use the same rule, interpolated between hourly samples.',
  },
  {
    name: 'McEwen 1991: lunar-Lambert photometric function',
    usedFor: 'Terrain shading in the Horizon view (mix of Lommel-Seeliger and Lambert).',
  },
  {
    name: 'Gläser et al. 2018, Planetary and Space Science 162: illumination conditions at the lunar poles',
    link: 'https://doi.org/10.1016/j.pss.2017.07.006',
    usedFor: 'Site coordinates of the south pole sites (Table 1 surface level, Table 2 at 2 m) and the check of our results: 20-year sunlight 79.1% here vs 81.0% in the paper.',
  },
  {
    name: 'Check against the Horizons web app',
    usedFor: 'Sun and Earth positions in the app match the Horizons web app.',
  },
  {
    name: 'Visual aids (not physical)',
    usedFor: 'Earthshine on the terrain is boosted, shadowed ground is lifted to dark gray, and a gray line marks the computed horizon, so the scene stays readable.',
  },
]

const MISSION_PDF: Ref[] = [
  {
    name: 'NASA SVS 4944 and SVS Moon datasets',
    link: 'https://svs.gsfc.nasa.gov/4944',
    usedFor: 'Inspiration for the look of the interface.',
  },
  {
    name: 'Artemis mission parameters for lunar landing (NASA NTRS 20230005904)',
    link: 'https://ntrs.nasa.gov/api/citations/20230005904/downloads/PlatteCity_Artemis.pdf',
    usedFor: 'Artemis landing parameters and the safety criteria that guide the Requirements panel.',
  },
  {
    name: 'Identifying lunar sites for landing and surface operations (NASA NTRS 20230016267)',
    link: 'https://ntrs.nasa.gov/api/citations/20230016267/downloads/Lunar%20Site%20Selection.pdf',
    usedFor: 'Background on how lunar landing and surface sites are identified, for the site comparison.',
  },
  {
    name: 'Lunar Pole Illumination and Communications Maps Computed from Goldstone Solar System Radar Elevation Data (JPL IPN 42-176)',
    link: 'https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.pdf',
    usedFor: 'Table 1 of north and south pole feature coordinates, a cross-check for the south pole sites.',
  },
  {
    name: 'Analysis of Deep Space Network Antenna Coverage (NASA NTRS 20120004035)',
    link: 'https://ntrs.nasa.gov/api/citations/20120004035/downloads/20120004035.pdf',
    usedFor: 'Background for the Earth link: communication coverage over time.',
  },
  {
    name: 'Lunar surface propagation (NASA Glenn SCaN)',
    link: 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/scan/lunar-surface-propagation/',
    usedFor: 'Background on communication on the lunar surface.',
  },
  {
    name: 'Commercial Lunar Payload Services (CLPS), NASA',
    link: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    usedFor: 'Missions, landers, landing sites and years shown on the CLPS sites (coordinates to confirm).',
  },
  {
    name: 'Apollo landing site coordinates: NSSDC (Lunar Module), Wagner et al. 2017',
    usedFor: 'Coordinates of the Apollo sites.',
  },
]

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#444] p-4">
      <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
      {note && <p className="mt-0.5 text-[11px] text-gray-400">{note}</p>}
      <ul className="mt-3 flex flex-col gap-3">{children}</ul>
    </section>
  )
}

function Item({ name, link, usedFor }: Ref) {
  return (
    <li className="text-xs leading-snug text-gray-300">
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="font-medium text-[#9fd3f2] hover:underline">
          {name}
        </a>
      ) : (
        <span className="font-medium text-gray-100">{name}</span>
      )}
      <p className="mt-0.5">
        <span className="text-gray-400">Used for: </span>
        {usedFor}
      </p>
    </li>
  )
}

export function ReferencesTab() {
  const layerIds = SELECTOR.flatMap((e) => e.options ?? [e.id])
  const layers = layerIds.map((id) => LAYERS.find((l) => l.id === id)).filter((l) => l !== undefined)
  const siteSources = [...new Set(SITES.map((s) => s.source))]

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#303030] p-3 text-gray-100 md:p-4 [&>*]:shrink-0">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
          References
        </h1>
        <p className="mt-1 text-xs text-gray-300">
          Planning aid, not flight grade. Every source and method used in the app, and what each one is used for.
        </p>
      </header>

      <div className="grid gap-3 xl:grid-cols-2">
        <Group title="Data">{DATA.map((r) => <Item key={r.name} {...r} />)}</Group>
        <Group title="Methods and checks">{METHODS.map((r) => <Item key={r.name} {...r} />)}</Group>
      </div>

      <Group
        title="Orbital view layers"
        note="Served by NASA Moon Trek as 256 px tiles. A tile pixel is not the resolution of the data. None of the layers depends on the date."
      >
        {layers.map((l) => (
          <li key={l.id} className="text-xs leading-snug text-gray-300">
            <span className="font-medium text-gray-100">{l.label}</span>
            <p className="mt-0.5">{l.sourceNote}</p>
            <p>
              <span className="text-gray-400">Coverage: </span>
              {l.coverageLabel} · <span className="text-gray-400">Tiles: </span>
              {tileLimitLabel(l)}
            </p>
            <p>{l.limitsNote}</p>
          </li>
        ))}
      </Group>

      <Group title="Sites" note="Where each site's coordinates come from.">
        {siteSources.map((source) => (
          <li key={source} className="text-xs leading-snug text-gray-300">
            <span className="font-medium text-gray-100">{source}</span>
            <p className="mt-0.5">
              <span className="text-gray-400">Used for: </span>
              {SITES.filter((s) => s.source === source).map((s) => s.name).join(', ')}
            </p>
          </li>
        ))}
        <li className="text-xs leading-snug text-gray-300">
          <span className="font-medium text-gray-100">CLPS missions without a site</span>
          <p className="mt-0.5">
            {CLPS_WITHOUT_SITE.join('; ')}. No landing point on the Moon, so no map marker and no Horizon view.
          </p>
        </li>
        <li className="text-xs leading-snug text-gray-300">
          <span className="font-medium text-gray-100">Point picked on the Orbital view</span>
          <p className="mt-0.5">
            <span className="text-gray-400">Used for: </span>
            any point you open in the Horizon view. It is not a curated site: no published coordinates or site study sit
            behind it. Terrain is computed in your browser from NASA tiles with the same method as the curated sites
            (checked against all six).
          </p>
        </li>
      </Group>

      <Group title="Mission and requirements sources" note="From the project research.">
        {MISSION_PDF.map((r) => <Item key={r.name} {...r} />)}
      </Group>

    </div>
  )
}
