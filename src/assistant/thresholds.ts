// Planning thresholds the assistant may look up (ai_assistant_context.md
// section 7, checked 2026-11-14). The assistant cites a value only with its
// citation text, and states the caveat when there is one.

export type ThresholdStatus = 'verified' | 'partly verified' | 'not verified'

export type Threshold = {
  id: string
  label: string
  value: number
  unit: string
  status: ThresholdStatus
  citation: string
  source: string
  caveat?: string
}

const HLS_DECKS = 'Artemis HLS Update 2024 (NTRS 20240009596); HLS Overview 2025 (NTRS 20250009323)'

export const THRESHOLDS: Threshold[] = [
  {
    id: 'landing-slope',
    label: 'Landing slope, below (about 100 m scale)',
    value: 10,
    unit: '°',
    status: 'verified',
    citation: 'Artemis III landing requirement',
    source: HLS_DECKS,
  },
  {
    id: 'eva-slope',
    label: 'EVA slope, below (about 2 km scale)',
    value: 20,
    unit: '°',
    status: 'verified',
    citation: 'Artemis III EVA requirement',
    source: HLS_DECKS,
  },
  {
    id: 'earth-visibility',
    label: 'Earth visibility, at least',
    value: 25,
    unit: '%',
    status: 'partly verified',
    citation: 'NASA map threshold; we apply it over the stay',
    source: HLS_DECKS,
    caveat: 'NASA does not define the time base; reading it as "% of the stay" is the team\'s choice.',
  },
  {
    id: 'lander-tilt',
    label: 'Landed vehicle tilt, at most',
    value: 8,
    unit: '°',
    status: 'partly verified',
    citation: 'Lander tilt tolerance (NASA OIG); the map uses it as a proxy for slope',
    source: 'NASA OIG report IG-26-004, 10 Mar 2026, p. 25',
    caveat: 'This is the tilt of the landed vehicle, not a terrain slope. On the map it is only a proxy.',
  },
  {
    id: 'sun-stay',
    label: 'Sun during the whole stay',
    value: 100,
    unit: '%',
    status: 'not verified',
    citation: 'Team plan default (Requirements panel)',
    source: 'Team plan; not checked against a NASA document in this round',
  },
]
