// Contract between the assistant panel (browser) and api/chat (server).
// No imports: the server and the browser both load this file.
//
// Messages use the OpenAI chat format, which Gemini, Groq and OpenRouter all
// accept on their OpenAI-compatible endpoints.

export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type WireMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type ChatRequest = { messages: WireMessage[] }

export type ChatResponse =
  // The model wants the browser to run tools, then send the results back.
  | { type: 'tool_calls'; message: Extract<WireMessage, { role: 'assistant' }> }
  // Final answer; every number in it was found in a tool result or the user's words.
  // `via`: which provider and model answered, e.g. "Groq · openai/gpt-oss-120b (complex question)".
  | { type: 'answer'; content: string; retried: boolean; via: string }
  // The answer had numbers no tool gave, twice: it is not shown.
  | { type: 'blocked'; content: string; unverified: string[]; via: string }
  | { type: 'error'; code: 'no_key' | 'quota' | 'rate_limited' | 'provider' | 'bad_request'; message: string }

type JsonSchema = {
  type: 'object'
  properties: Record<string, { type: string; description: string; enum?: string[] }>
  required?: string[]
}

export type ToolDef = {
  type: 'function'
  function: { name: string; description: string; parameters: JsonSchema }
}

function tool(name: string, description: string, properties: JsonSchema['properties'] = {}, required: string[] = []): ToolDef {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } }
}

const siteIdParam = { type: 'string', description: 'Site id from listSites. Omit for the site on screen.' }

// Read tools return data. Write tools change reversible app state; the app
// shows a banner for each change.
export const TOOL_DEFS: ToolDef[] = [
  tool('getAppState', 'Current screen: view, site, selected date/time (UTC), stay length, map layer, requirements.'),
  tool('explainCurrentView', 'What the panels on screen show right now, in plain words.'),
  tool('listSites', 'Landing sites in the app with coordinates and coordinate source.'),
  tool(
    'getSiteMetrics',
    'Sun and Earth at the selected time for one site: status, % of disc visible, elevation, azimuth, terrain horizon, next set/rise, Earth lit %, and % of the stay with Sun and Earth link.',
    { siteId: siteIdParam },
  ),
  tool(
    'evaluateRequirements',
    'Checks every site with data against the current requirements (Sun %, Earth link %, slope) for the selected date and stay. Screening only.',
  ),
  tool('listLayers', 'Orbital view map layers: what each shows, coverage, source and limits.'),
  tool(
    'getThreshold',
    'A planning threshold with its value, source and verified status. Omit id to list all. Only verified thresholds may be cited as requirements.',
    { id: { type: 'string', description: 'Threshold id. Omit to list all.' } },
  ),
  tool('setDate', 'Change the selected date and time (UTC). Snaps to the nearest hourly sample.', {
    timeUtc: { type: 'string', description: 'ISO 8601 UTC, e.g. 2026-11-17T00:00Z' },
  }, ['timeUtc']),
  tool('setStayDays', 'Change the stay length in days (0.5 to 29.5, steps of 0.5).', {
    days: { type: 'number', description: 'Stay length in days' },
  }, ['days']),
  tool('setLayer', 'Show one map layer on the Orbital view.', {
    layerId: { type: 'string', description: 'Layer id from listLayers' },
  }, ['layerId']),
  tool('selectSite', 'Select a site (Orbital view flies to it; Horizon view switches to it).', { siteId: { ...siteIdParam, description: 'Site id from listSites' } }, ['siteId']),
  tool('openHorizonView', 'Open the first-person Horizon view for a site.', { siteId: siteIdParam }),
  tool(
    'openHorizonViewAtPoint',
    'Open the Horizon view at any point on the Moon given by the user (latitude, east longitude). Use only coordinates the user gave or a site listed by listSites.',
    {
      latitudeDeg: { type: 'number', description: 'Latitude in degrees, negative = south' },
      longitudeDeg: { type: 'number', description: 'East longitude in degrees (0 to 360)' },
    },
    ['latitudeDeg', 'longitudeDeg'],
  ),
  tool('backToOrbitalView', 'Go back to the Orbital view (globe).'),
  tool(
    'setRequirements',
    'Turn the requirements screening on or off and set its thresholds. Only set values the user asked for.',
    {
      enabled: { type: 'boolean', description: 'Show requirements on the map' },
      sunOn: { type: 'boolean', description: 'Use the Sun requirement' },
      sunMinPercent: { type: 'number', description: 'Minimum % of the stay with Sun (0-100, steps of 5)' },
      earthOn: { type: 'boolean', description: 'Use the Earth link requirement' },
      earthMinPercent: { type: 'number', description: 'Minimum % of the stay with Earth link (0-100, steps of 5)' },
      slopeOn: { type: 'boolean', description: 'Use the slope requirement' },
      slopeMaxDeg: { type: 'number', description: 'Maximum slope in degrees (1-30, steps of 1)' },
    },
  ),
]

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.function.name)
