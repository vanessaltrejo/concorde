import { useState, type ReactNode } from 'react'
import { SITES } from '../data/sites'
import { formatCoords, lastEdited, usePlaces } from '../state/places'
import { Wordmark } from './Landing'
import { navigate } from './nav'

// Projects home (after "Execute Concordemoon"): the way into the tool and a
// short summary. Solid matte cards, flat rectangular outline buttons as on the
// launcher. Saved places are managed on the Compare page.

const horizonUrl = (p: { latDeg: number; lonDeg: number }) => `/horizon-view?pt=${p.latDeg.toFixed(4)},${p.lonDeg.toFixed(4)}`

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

const PIN = (
  <>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>
)

export function ProjectsHome() {
  const places = usePlaces()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = q
    ? [
        ...places.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ key: `p:${p.id}`, label: p.name, sub: `Saved place · ${formatCoords(p.latDeg, p.lonDeg)}`, go: () => navigate(horizonUrl(p)) })),
        ...SITES.filter((s) => s.name.toLowerCase().includes(q)).map((s) => ({ key: `s:${s.id}`, label: s.name, sub: s.group, go: () => navigate(`/orbital-view?site=${s.id}`) })),
      ].slice(0, 8)
    : []
  const lastEditedPlace = places.length ? [...places].sort((a, b) => lastEdited(b).localeCompare(lastEdited(a)))[0] : null

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-[#121314] text-gray-100">
      {/* Atmosphere: the Moon, large and dim, behind a dark vignette. */}
      <img src="/textures/moon-hero.png" alt="" aria-hidden className="pointer-events-none absolute -right-40 -top-56 w-[60rem] max-w-none select-none opacity-25 grayscale" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 70% 0%, rgba(18,19,20,0.2), #121314 75%)' }} />

      {/* Top bar */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 md:px-10">
        <button type="button" onClick={() => navigate('/')} className="shrink-0" title="Back to the launcher">
          <Wordmark />
        </button>
        <div className="relative mx-auto w-full max-w-xl">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a0a0]">
            <svg {...icon}>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the Moon: sites and saved places"
            aria-label="Search sites and saved places"
            className="card-matte w-full rounded-xl py-2.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#8f9396] focus:border-white/30"
          />
          {results.length > 0 && (
            <ul className="card-matte absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl py-1">
              {results.map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={r.go} className="flex w-full flex-col px-4 py-2 text-left hover:bg-white/[0.06]">
                    <span className="text-sm text-white">{r.label}</span>
                    <span className="text-[11px] text-[#8f9396]">{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/orbital-view')}
          className="btn-outline flex h-10 w-10 shrink-0 items-center justify-center text-lg"
          aria-label="New pin"
          title="New pin: open the globe and click the Moon"
        >
          +
        </button>
        <button type="button" onClick={() => navigate('/orbital-view')} className="btn-outline shrink-0 px-5 py-2.5 text-sm font-medium">
          Explore the Moon
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-6 pb-10 md:px-10">
        <div className="mt-10 mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Your Moon</h1>
          <p className="mt-2 text-[#a7abad]">Saved places and the first-person view of any point on the Moon.</p>
        </div>

        {/* Cards row, after the reference: icon tile, title, small meta, one strong number or action. */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card icon={PIN} title="Saved places" meta="In this browser">
            <p className="mt-6 text-5xl font-bold tabular-nums text-white">{places.length}</p>
            <p className="mt-1 text-xs text-[#8f9396]">{lastEditedPlace ? `Last edited: ${lastEditedPlace.name}` : 'No pins yet'}</p>
          </Card>
          <Card
            icon={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>}
            title="Terrain detail"
            meta="NASA LOLA"
          >
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li className="flex items-baseline justify-between gap-2"><span className="text-[#a7abad]">South of 86°S</span><span className="font-medium text-white">20 m · 200 km</span></li>
              <li className="flex items-baseline justify-between gap-2"><span className="text-[#a7abad]">Up to 80° N/S</span><span className="font-medium text-white">118 m · 50 km</span></li>
            </ul>
            <p className="mt-3 text-xs text-[#8f9396]">Computed in your browser, same method as the curated sites.</p>
          </Card>
          <Card className="md:col-span-2" icon={<><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>} title="Start on the globe" meta="Orbital view">
            <h2 className="mt-4 text-2xl font-bold text-white">Pick any point on the Moon and see its sky</h2>
            <p className="mt-2 max-w-lg text-sm text-[#a7abad]">
              Click the Moon, add a pin, then open its Horizon view to see when the Sun and Earth clear the real terrain.
            </p>
            <button type="button" onClick={() => navigate('/orbital-view')} className="btn-outline mt-5 self-start px-5 py-2 text-sm font-medium">
              Open the globe
            </button>
          </Card>
        </section>

      </main>
    </div>
  )
}

function Card({ icon: path, title, meta, className = '', children }: { icon: ReactNode; title: string; meta: string; className?: string; children: ReactNode }) {
  return (
    <section className={'card-matte flex flex-col rounded-2xl p-5 ' + className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <svg {...icon}>{path}</svg>
          </span>
          <h2 className="text-base font-medium text-white">{title}</h2>
        </div>
        <span className="text-[11px] text-[#8f9396]">{meta}</span>
      </div>
      {children}
    </section>
  )
}
