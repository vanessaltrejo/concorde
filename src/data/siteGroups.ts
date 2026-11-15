import type { SiteEntry } from './sites'

// One colour per site group, used by the site menus and the map markers so the
// same colour always means the same kind of site. Chosen to read on dark gray.
export const GROUP_COLOR: Record<SiteEntry['group'], string> = {
  'South pole': '#F5A524', // orange
  'CLPS missions': '#B794F6', // purple
  'Apollo landing sites': '#4ADE80', // green
  'Saved points': '#56B4E9', // sky blue
}
