// The assistant's tools, run in the browser on the app's own data and state.
// The model only sees what these functions return. Each result lists its
// sources (shown as chips); write tools also return a banner text.
import { getLayer, LAYERS, tileLimitLabel } from '../data/layers'
import { loadSiteLight } from '../data/loadSiteData'
import { DEFAULT_SITE_ID, getSite, SITES } from '../data/sites'
import { formatDuration } from '../scene/formatTime'
import { DEFAULT_CRITERIA, evaluateSite, loadSiteSlopes, type Criteria } from '../scene/requirements'
import { computeStay, DEFAULT_STAY_DAYS, MAX_STAY_DAYS, MIN_STAY_DAYS } from '../scene/stay'
import { indexForTime, timeOfIndex } from '../scene/timeSelection'
import { bodyVisibility } from '../scene/visibility'
import { buildTimeline, nextTransition, type NextTransition, type SkyBodyKey } from '../scene/windows'
import type { SkySample } from '../types'
import { THRESHOLDS } from './thresholds'

export type AppView = 'orbital' | 'horizon' | 'dashboard'

export type AppSnapshot = {
  view: AppView
  orbitalSiteId: string | null
  horizonSiteId: string
  timeMs: number | null
  stayDays: number
  layerId: string
  requirementsOn: boolean
  criteria: Criteria
}

// How the tools read and change the app. Setters must update what getState()
// returns at once, so several tool calls in one turn see each other's changes.
export type AppBridge = {
  getState: () => AppSnapshot
  setTimeMs: (ms: number) => void
  setStayDays: (days: number) => void
  setLayerId: (id: string) => void
  selectSite: (siteId: string) => void
  openHorizonView: (siteId: string) => void
  backToOrbitalView: () => void
  setRequirementsOn: (on: boolean) => void
  setCriteria: (criteria: Criteria) => void
}

export type ToolOutcome = { result: unknown; sources: string[]; action?: string }

const HORIZONS = 'JPL Horizons'
const LOLA = 'LOLA terrain'
const SLOPES = 'Site slopes (LOLA plane fit)'

class ToolInputError extends Error {}

// Same ranges as the Requirements panel sliders (RequirementsPanel.tsx).
const RANGES = {
  sunMinPercent: { min: 0, max: 100, step: 5 },
  earthMinPercent: { min: 0, max: 100, step: 5 },
  slopeMaxDeg: { min: 1, max: 30, step: 1 },
}

// "2026-11-17 00:00 UTC". Same minute rounding as the sidebar.
export function utcMinute(ms: number): string {
  return `${new Date(Math.round(ms / 60_000) * 60_000).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

const round = (value: number, decimals: number) => Number(value.toFixed(decimals))

function currentSiteId(state: AppSnapshot): string {
  return state.view === 'horizon' ? state.horizonSiteId : (state.orbitalSiteId ?? DEFAULT_SITE_ID)
}

function siteWithData(siteId: unknown, state: AppSnapshot): string {
  const id = typeof siteId === 'string' && siteId ? siteId : currentSiteId(state)
  const site = SITES.find((s) => s.id === id)
  if (!site) throw new ToolInputError(`Unknown site "${id}". Call listSites for valid ids.`)
  if (!site.hasSkyData) throw new ToolInputError(`${site.name} has no Sun/Earth data in the app.`)
  return id
}

function dataPeriod(samples: SkySample[]) {
  return {
    startUtc: utcMinute(Date.parse(samples[0].timeUtc)),
    endUtc: utcMinute(Date.parse(samples[samples.length - 1].timeUtc)),
    stepHours: 1,
  }
}

function describeNext(next: NextTransition, body: 'Sun' | 'Earth') {
  const event = next.kind === 'set' ? `${body.toLowerCase()}set` : `${body.toLowerCase()}rise`
  if (!next.found) return { event, withinData: false, note: `No ${event} before the end of the data (${formatDuration(next.afterMs)} from now).` }
  return { event, withinData: true, timeUtc: utcMinute(next.timeMs), in: formatDuration(next.inMs) }
}

const STATUS_TEXT = { visible: 'Visible', partial: 'Partly hidden', hidden: 'Hidden' }

async function siteMetrics(siteId: string, state: AppSnapshot) {
  const light = await loadSiteLight(siteId)
  const { samples } = light.sky
  const index = indexForTime(samples, state.timeMs)
  const sample = samples[index]
  const body = (key: SkyBodyKey, label: 'Sun' | 'Earth') => {
    const vis = bodyVisibility(sample[key], light.horizon)
    return {
      status: STATUS_TEXT[vis.state],
      discVisiblePercent: round(vis.fraction * 100, 1),
      elevationDeg: round(sample[key].elevationDeg, 2),
      azimuthDeg: round(sample[key].azimuthDeg, 2),
      terrainHorizonDeg: round(vis.horizonDeg, 2),
      next: describeNext(nextTransition(buildTimeline(samples, light.horizon, key), index), label),
    }
  }
  const stay = computeStay(samples, light.horizon, index, state.stayDays)
  const slope = (await loadSiteSlopes())[siteId]
  return {
    site: { id: siteId, name: getSite(siteId).name },
    selectedTimeUtc: utcMinute(Date.parse(sample.timeUtc)),
    terrainSlope: slope
      ? { deg: slope.slopeDeg, baselineM: slope.baselineM, note: 'Plane fit to LOLA terrain around the site; compare only at the same baseline.' }
      : null,
    sun: body('sun', 'Sun'),
    earth: { ...body('earth', 'Earth'), litPercent: round(sample.earthIlluminatedPct, 0) },
    stay: {
      arrivalUtc: utcMinute(stay.arrivalMs),
      requestedDays: stay.requestedDays,
      coveredDays: round(stay.coveredDays, 2),
      sunPercent: round(stay.sunPercent, 1),
      earthPercent: round(stay.earthPercent, 1),
      runsPastEndOfData: stay.truncated,
    },
    dataPeriod: dataPeriod(samples),
    rule: 'A body counts as visible when any part of its disc is above the terrain horizon (NASA PGDA rule). Partly hidden counts as visible for the link.',
  }
}

// Where each active requirement value comes from, so the model can say when a
// value is not verified or was chosen by the user.
function thresholdNotes(criteria: Criteria): string[] {
  const describe = (label: string, value: number, unit: string, ids: string[]) => {
    const t = THRESHOLDS.find((x) => ids.includes(x.id) && x.value === value)
    if (!t) return `${label} ${value}${unit}: value chosen in the app, not a NASA threshold.`
    return `${label} ${value}${unit}: ${t.citation} (${t.status})${t.caveat ? `. ${t.caveat}` : ''}`
  }
  const notes: string[] = []
  if (criteria.sun.on) notes.push(describe('Sun', criteria.sun.minPercent, '%', ['sun-stay']))
  if (criteria.earth.on) notes.push(describe('Earth link', criteria.earth.minPercent, '%', ['earth-visibility']))
  if (criteria.slope.on) notes.push(describe('Slope', criteria.slope.maxDeg, '°', ['landing-slope', 'lander-tilt']))
  return notes
}

function describeView(state: AppSnapshot) {
  if (state.view === 'horizon') {
    return {
      view: 'Horizon view',
      site: getSite(state.horizonSiteId).name,
      panels: [
        '3D first-person view from 2 m above the ground, with the real terrain, the Sun and the Earth discs, labels and a compass.',
        'Left sidebar: date slider, Sun and Earth status, set/rise times, elevation, azimuth, terrain horizon, Earth lit fraction, stay summary, period summary, credits.',
        'Buttons: Look at Sun, Look at Earth, zoom - / +, Back to Orbital view.',
      ],
    }
  }
  if (state.view === 'orbital') {
    return {
      view: 'Orbital view',
      selectedSite: state.orbitalSiteId ? getSite(state.orbitalSiteId).name : null,
      layer: getLayer(state.layerId).label,
      requirementsShown: state.requirementsOn,
      panels: [
        'Moon globe with NASA Moon Trek imagery and site markers.',
        'Left: map layer selector and the Requirements panel (green = meets the requirements, screening only).',
        'Right: site panel with site menu, date and time, stay length, stay summary, horizon preview, Open Horizon view, Topography view, Back to globe.',
      ],
    }
  }
  return { view: 'Dashboard', panels: ['Placeholder, not built yet.'] }
}

function inRange(value: unknown, { min, max, step }: { min: number; max: number; step: number }, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ToolInputError(`${name} must be a number.`)
  if (value < min || value > max) throw new ToolInputError(`${name} must be between ${min} and ${max}.`)
  return Math.round(value / step) * step
}

// Accepts "2026-11-17", "2026-11-17T00:00", "2026-11-17 00:00" and full ISO;
// a time without a zone is read as UTC, never the browser's zone.
function parseUtc(text: unknown): number {
  if (typeof text !== 'string') throw new ToolInputError('timeUtc must be a string.')
  let t = text.trim().replace(' ', 'T').replace(/\s*UTC$/i, 'Z')
  if (/T\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(t)) t += 'Z'
  const ms = Date.parse(t)
  if (Number.isNaN(ms)) throw new ToolInputError(`Could not read the date "${text}". Use ISO 8601 UTC.`)
  return ms
}

type Args = Record<string, unknown>

const tools: Record<string, (args: Args, bridge: AppBridge) => Promise<ToolOutcome> | ToolOutcome> = {
  getAppState(_args, bridge) {
    const s = bridge.getState()
    return {
      result: {
        view: s.view,
        siteOnScreen: getSite(currentSiteId(s)).name,
        siteId: currentSiteId(s),
        selectedTimeUtc: s.timeMs === null ? 'first sample of the data' : utcMinute(s.timeMs),
        stayDays: s.stayDays,
        layer: { id: s.layerId, label: getLayer(s.layerId).label },
        requirements: { shownOnMap: s.requirementsOn, criteria: s.criteria, defaults: DEFAULT_CRITERIA },
        // Ranges of the app's controls (stay slider, Requirements panel sliders).
        controlLimits: {
          stayDays: { min: MIN_STAY_DAYS, max: MAX_STAY_DAYS, step: 0.5, default: DEFAULT_STAY_DAYS },
          ...RANGES,
        },
      },
      sources: [],
    }
  },

  explainCurrentView(_args, bridge) {
    return { result: describeView(bridge.getState()), sources: [] }
  },

  listSites() {
    return {
      result: SITES.map((s) => ({
        id: s.id,
        name: s.name,
        group: s.group,
        latitudeDeg: s.latitudeDeg,
        longitudeDegEast: s.longitudeDeg,
        coordinateSource: s.source,
        hasSunEarthData: s.hasSkyData,
      })),
      sources: ['Site list (Gläser 2018; NSSDC)'],
    }
  },

  async getSiteMetrics(args, bridge) {
    const state = bridge.getState()
    return { result: await siteMetrics(siteWithData(args.siteId, state), state), sources: [HORIZONS, LOLA, SLOPES] }
  },

  async evaluateRequirements(_args, bridge) {
    const s = bridge.getState()
    const withData = SITES.filter((site) => site.hasSkyData)
    const [lights, slopes] = await Promise.all([Promise.all(withData.map((site) => loadSiteLight(site.id))), loadSiteSlopes()])
    const sites = withData.map((site, i) => {
      const r = evaluateSite(site.id, lights[i], slopes[site.id] ?? null, s.criteria, s.timeMs, s.stayDays)
      return {
        site: site.name,
        meetsRequirements: r.meets,
        sunPercent: round(r.sunPercent, 1),
        earthPercent: round(r.earthPercent, 1),
        slope: r.slope ? { deg: r.slope.slopeDeg, baselineM: r.slope.baselineM } : null,
        passes: r.passes,
      }
    })
    return {
      result: {
        criteria: s.criteria,
        arrivalUtc: s.timeMs === null ? 'first sample of the data' : utcMinute(s.timeMs),
        stayDays: s.stayDays,
        sites,
        thresholdNotes: thresholdNotes(s.criteria),
        note: 'Screening only, not "safe": rocks, small craters and dust are not in the data. Slopes are compared only at the same baseline.',
      },
      sources: [HORIZONS, LOLA, SLOPES],
    }
  },

  listLayers() {
    return {
      result: LAYERS.map((l) => ({
        id: l.id,
        label: l.label,
        coverage: l.coverageLabel,
        source: l.sourceNote,
        limits: l.limitsNote,
        tiles: tileLimitLabel(l),
      })),
      sources: ['NASA Moon Trek'],
    }
  },

  getThreshold(args) {
    if (typeof args.id === 'string' && args.id) {
      const t = THRESHOLDS.find((x) => x.id === args.id)
      if (!t) throw new ToolInputError(`Unknown threshold. Valid ids: ${THRESHOLDS.map((x) => x.id).join(', ')}.`)
      return { result: t, sources: [t.citation] }
    }
    return { result: THRESHOLDS, sources: ['Threshold table (NASA HLS decks, NASA OIG)'] }
  },

  async setDate(args, bridge) {
    const state = bridge.getState()
    const wanted = parseUtc(args.timeUtc)
    const { samples } = (await loadSiteLight(siteWithData(undefined, state))).sky
    const first = Date.parse(samples[0].timeUtc)
    const last = Date.parse(samples[samples.length - 1].timeUtc)
    if (wanted < first - 30 * 60_000 || wanted > last + 30 * 60_000) {
      return { result: { changed: false, reason: 'Date outside the app data', dataPeriod: dataPeriod(samples) }, sources: [HORIZONS] }
    }
    const snapped = timeOfIndex(samples, indexForTime(samples, wanted))
    bridge.setTimeMs(snapped)
    return {
      result: { changed: true, selectedTimeUtc: utcMinute(snapped) },
      sources: [],
      action: `Date set to ${utcMinute(snapped)}`,
    }
  },

  setStayDays(args, bridge) {
    const days = inRange(args.days, { min: MIN_STAY_DAYS, max: MAX_STAY_DAYS, step: 0.5 }, 'days')
    bridge.setStayDays(days)
    return { result: { changed: true, stayDays: days }, sources: [], action: `Stay length set to ${days} days` }
  },

  setLayer(args, bridge) {
    const id = String(args.layerId ?? '')
    const layer = LAYERS.find((l) => l.id === id)
    if (!layer) throw new ToolInputError(`Unknown layer. Valid ids: ${LAYERS.map((l) => l.id).join(', ')}.`)
    bridge.setLayerId(id)
    const onOrbital = bridge.getState().view === 'orbital'
    return {
      result: { changed: true, layer: layer.label, limits: layer.limitsNote, visibleNow: onOrbital },
      sources: ['NASA Moon Trek'],
      action: `Map layer: ${layer.label}${onOrbital ? '' : ' (shown on the Orbital view)'}`,
    }
  },

  selectSite(args, bridge) {
    const id = String(args.siteId ?? '')
    const site = SITES.find((s) => s.id === id)
    if (!site) throw new ToolInputError(`Unknown site "${id}". Call listSites for valid ids.`)
    bridge.selectSite(id)
    return { result: { changed: true, site: site.name }, sources: [], action: `Site: ${site.name}` }
  },

  openHorizonView(args, bridge) {
    const id = siteWithData(args.siteId, bridge.getState())
    bridge.openHorizonView(id)
    return {
      result: { changed: true, view: 'Horizon view', site: getSite(id).name, note: 'The terrain takes a few seconds to load.' },
      sources: [],
      action: `Opened the Horizon view: ${getSite(id).name}`,
    }
  },

  backToOrbitalView(_args, bridge) {
    bridge.backToOrbitalView()
    return { result: { changed: true, view: 'Orbital view' }, sources: [], action: 'Back to the Orbital view' }
  },

  setRequirements(args, bridge) {
    const s = bridge.getState()
    const c = s.criteria
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
    const next: Criteria = {
      sun: {
        on: bool(args.sunOn, c.sun.on),
        minPercent: args.sunMinPercent === undefined ? c.sun.minPercent : inRange(args.sunMinPercent, RANGES.sunMinPercent, 'sunMinPercent'),
      },
      earth: {
        on: bool(args.earthOn, c.earth.on),
        minPercent:
          args.earthMinPercent === undefined ? c.earth.minPercent : inRange(args.earthMinPercent, RANGES.earthMinPercent, 'earthMinPercent'),
      },
      slope: {
        on: bool(args.slopeOn, c.slope.on),
        maxDeg: args.slopeMaxDeg === undefined ? c.slope.maxDeg : inRange(args.slopeMaxDeg, RANGES.slopeMaxDeg, 'slopeMaxDeg'),
      },
    }
    const enabled = bool(args.enabled, true)
    bridge.setCriteria(next)
    bridge.setRequirementsOn(enabled)
    const parts = [
      next.sun.on ? `Sun ≥ ${next.sun.minPercent}%` : 'Sun off',
      next.earth.on ? `Earth ≥ ${next.earth.minPercent}%` : 'Earth off',
      next.slope.on ? `slope ≤ ${next.slope.maxDeg}°` : 'slope off',
    ]
    return {
      result: { changed: true, shownOnMap: enabled, criteria: next, visibleNow: s.view === 'orbital' },
      sources: [],
      action: enabled ? `Requirements: ${parts.join(', ')}` : 'Requirements hidden',
    }
  },
}


export async function runTool(name: string, rawArgs: string, bridge: AppBridge): Promise<ToolOutcome> {
  const fn = tools[name]
  if (!fn) return { result: { error: `Unknown tool ${name}` }, sources: [] }
  let args: Args = {}
  try {
    const parsed: unknown = rawArgs ? JSON.parse(rawArgs) : {}
    if (typeof parsed === 'object' && parsed !== null) args = parsed as Args
  } catch {
    return { result: { error: 'Arguments were not valid JSON' }, sources: [] }
  }
  try {
    return await fn(args, bridge)
  } catch (error) {
    if (error instanceof ToolInputError) return { result: { error: error.message }, sources: [] }
    return { result: { error: `The app could not read that data: ${error instanceof Error ? error.message : String(error)}` }, sources: [] }
  }
}
