// Gatekeeper for the terrain tiles (docs/HORIZON_ANYWHERE_PLAN.md).
//
// The R2 bucket is private; this Worker is the only way to read it.
// Cost protection, in order:
//  1. The Worker runs on the Workers FREE plan: at most 100,000 requests a
//     day, refused (Error 1027) beyond that, never billed. Even if every
//     request read R2, a month stays under 3.1 million reads, about 31% of
//     the free 10 million Class B operations.
//  2. Only GET/HEAD of known tile paths from the app's own origins reach R2;
//     everything else is refused before any R2 read.
//  3. Answers are cached (Cloudflare cache here, browsers for a year), so
//     repeat views do not read R2 again.
// Never move this Worker to the Workers Paid plan: that removes limit 1.

const TILE_PATH = /^\/(manifest\.json|(global-118m|south-(20|80|160|320|640)m)\/\d{1,3}\/\d{1,3}\.bin)$/
const YEAR = 31536000

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function refuse(status, text, origin) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', ...(origin ? corsHeaders(origin) : {}) },
  })
}

export default {
  /**
   * @param {Request} request
   * @param {{ TILES: R2Bucket, ALLOWED_ORIGINS: string }} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    const origin = request.headers.get('Origin')
    // Browsers send Origin on every cross-site fetch. A missing or unknown
    // origin is not the app: refuse without touching R2.
    if (!origin || !allowed.includes(origin)) return refuse(403, 'Not allowed', null)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    if (request.method !== 'GET' && request.method !== 'HEAD') return refuse(405, 'Method not allowed', origin)

    const url = new URL(request.url)
    if (!TILE_PATH.test(url.pathname)) return refuse(404, 'Not found', origin)
    const key = url.pathname.slice(1)

    // Cache key without the Origin, so all visitors share one cached copy.
    const cacheKey = new Request(`${url.origin}/${key}`, { method: 'GET' })
    const cache = caches.default
    let response = await cache.match(cacheKey)
    if (!response) {
      const object = await env.TILES.get(key) // one R2 read (Class B)
      if (!object) return refuse(404, 'Not found', origin)
      const isManifest = key === 'manifest.json'
      response = new Response(object.body, {
        headers: {
          'Content-Type': isManifest ? 'application/json' : 'application/octet-stream',
          // Tiles never change; the manifest may be rebuilt.
          'Cache-Control': isManifest ? 'public, max-age=3600' : `public, max-age=${YEAR}, immutable`,
          ETag: object.httpEtag,
        },
      })
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
    }
    const headers = new Headers(response.headers)
    for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v)
    return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers })
  },
}
