import { CLPS_WITHOUT_SITE } from '../data/sites'
import type { SiteEntry } from '../data/sites'

// CLPS missions that land at a site. Completed = filled NASA-blue dot,
// Scheduled = hollow dot (shape and text, not color alone).
export function MissionList({ site }: { site: SiteEntry }) {
  if (!site.missions?.length) return null
  return (
    <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
      <h3 className="text-sm font-medium">CLPS missions here</h3>
      <ul className="flex flex-col gap-1 text-xs text-gray-300">
        {site.missions.map((m) => (
          <li key={m.name} className="flex items-baseline justify-between gap-2">
            <span>
              <span aria-hidden className="mr-1.5 text-[#7fb0ff]">
                {m.status === 'Completed' ? '●' : '○'}
              </span>
              <span className="font-medium text-gray-100">{m.name}</span> · {m.lander}
            </span>
            <span className="shrink-0">
              {m.status} {m.year}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ClpsWithoutSiteNote() {
  return (
    <details className="text-xs text-gray-300">
      <summary className="cursor-pointer font-medium text-gray-100">CLPS missions without a site</summary>
      <ul className="mt-1 list-disc pl-4">
        {CLPS_WITHOUT_SITE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-1">No landing point on the Moon, so no map marker and no Horizon view.</p>
    </details>
  )
}
