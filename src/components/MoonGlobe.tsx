import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cartographic,
  Ellipsoid,
  GeographicTilingScheme,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  SkyBox,
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  DistanceDisplayCondition,
  Entity,
  LabelStyle,
  VerticalOrigin,
  ConstantProperty,
  HeightReference,
  type ImageryLayer,
  type Primitive,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { getLayer, photoBase, tileUrl, type TileSource } from '../data/layers'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { getSite, SITES } from '../data/sites'
import {
  evaluateSite,
  loadSiteSlopes,
  type Criteria,
  type SiteSlope,
} from '../scene/requirements'
import { RequirementsPanel } from './RequirementsPanel'
import { classifyZones, loadEphemeris, loadZoneGrid, type Ephemeris, type ZoneGrid } from '../scene/zones'
import { addZonePrimitive, colorZones, removeZonePrimitive } from './zoneLayer'
import { useZoneShares } from '../scene/useZoneShares'
import {
  classifyGlobal,
  computeGlobalShares,
  fineSlopeAt,
  globalCellIndex,
  globalSlopeShare,
  loadFineSlope,
  loadGlobalSlope,
  meetsAt,
  type FineSlope,
  type GlobalSlope,
} from '../scene/globalCells'
import { addGlobalLayer, raiseGlobalLayer, removeGlobalLayer } from './globalLayer'
import { LayerControl } from './LayerControl'
import { DEFAULT_MARKER_FILTER, siteVisible, type MarkerFilter } from '../scene/markers'
import { addPlace, formatCoords, usePlaces, type Place } from '../state/places'
import { SitePanel } from './SitePanel'
import { coverage } from '../terrain/anywhere'

type Picked = { latitudeDeg: number; longitudeDeg: number; cell: number | null }

function makeProvider(source: TileSource) {
  const [west, south, east, north] = source.rectangle
  return new UrlTemplateImageryProvider({
    url: tileUrl(source),
    tilingScheme: new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON }),
    // Only ask for tiles inside the data coverage (no 404 requests outside it).
    rectangle: Rectangle.fromDegrees(west, south, east, north),
    maximumLevel: source.maxLevel,
    tileWidth: 256,
    tileHeight: 256,
  })
}

const SITE_COLOR = Color.fromCssColorString('#56B4E9') // Okabe-Ito sky blue
const MEETS_COLOR = Color.fromCssColorString('#009E73') // Okabe-Ito bluish green
const EXCLUDED_COLOR = Color.fromCssColorString('#8a8a8a')
const SELECTED_COLOR = Color.WHITE

// Cesium objects are mutable by design; the mutation lives in a helper
// (same pattern as the Horizon view, PROJECT_MEMORY problem #22).
// `meets` is null when requirements are off; then every site has the default colour.
function highlightSite(viewer: Viewer, siteId: string | null, meets: Record<string, boolean> | null) {
  for (const entity of viewer.entities.values) {
    if (entity.id.startsWith('pin:')) continue
    const status = meets ? meets[entity.id] : undefined
    const base = status === undefined ? SITE_COLOR : status ? MEETS_COLOR : EXCLUDED_COLOR
    if (entity.point) entity.point.color = new ConstantProperty(entity.id === siteId ? SELECTED_COLOR : base)
    if (entity.label) {
      const name = getSite(entity.id).name
      // Text, not only colour: ✓ meets, ✕ excluded.
      entity.label.text = new ConstantProperty(status === undefined ? name : `${name} ${status ? '✓' : '✕'}`)
    }
  }
  viewer.scene.requestRender()
}

// Labels show when the camera is close (so the three south pole sites, about
// 15 km apart, do not overlap from far away) or while the cursor is on the marker.
const LABEL_NEAR = new DistanceDisplayCondition(0, 400_000)

function showHoverLabel(viewer: Viewer, hoveredId: string | null) {
  for (const entity of viewer.entities.values) {
    if (entity.label) {
      entity.label.distanceDisplayCondition = new ConstantProperty(entity.id === hoveredId ? undefined : LABEL_NEAR)
    }
  }
  viewer.scene.requestRender()
}

// Saved places are drawn as map pins (entity id "pin:<placeId>").
const PIN_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38"><path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.5 14 37 14 37s12.5-14.5 12.5-23.7C26.5 6.4 21 1 14 1z" fill="#1a73e8" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="13.5" r="4.6" fill="#0b2e6b"/></svg>',
  )

function syncPins(viewer: Viewer, places: Place[], show: boolean) {
  for (const entity of [...viewer.entities.values]) if (entity.id.startsWith('pin:')) viewer.entities.remove(entity)
  if (show) {
    for (const place of places) {
      viewer.entities.add({
        id: `pin:${place.id}`,
        position: Cartesian3.fromDegrees(place.lonDeg, place.latDeg, 0, Ellipsoid.MOON),
        billboard: {
          image: PIN_IMAGE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          heightReference: HeightReference.NONE,
        },
        label: {
          text: place.name,
          font: '13px sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -40),
          distanceDisplayCondition: LABEL_NEAR,
        },
      })
    }
  }
  viewer.scene.requestRender()
}

function applyMarkerFilter(viewer: Viewer, filter: MarkerFilter) {
  for (const site of SITES) {
    const entity = viewer.entities.getById(site.id)
    if (entity) entity.show = siteVisible(site, filter)
  }
  viewer.scene.requestRender()
}

type PinMenu = { placeId: string; x: number; y: number }

type RequirementsData ={ lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope> }

const ZONE_ALTITUDE_M = 150_000
const TOPOGRAPHY_ALTITUDE_M = 40_000
const GLOBE_ALTITUDE_M = 6_000_000

// Fly the camera over a site, looking straight down.
function flyOver(viewer: Viewer, siteId: string, altitudeM: number, onComplete?: () => void) {
  const site = getSite(siteId)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(site.longitudeDeg, site.latitudeDeg, altitudeM, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 2,
    complete: onComplete,
  })
}

// Calls `done` once the globe has no tiles left to load (or after 10 s).
// Returns a function that cancels it.
function whenTilesLoaded(viewer: Viewer, done: () => void): () => void {
  let finished = false
  const timers: number[] = []
  const stop = viewer.scene.globe.tileLoadProgressEvent.addEventListener((queued: number) => {
    if (queued === 0) finish()
  })
  function cleanup() {
    finished = true
    stop()
    timers.forEach((t) => window.clearTimeout(t))
  }
  function finish() {
    if (finished) return
    cleanup()
    done()
  }
  // The tiles may already be loaded when the flight ends, so no event comes.
  timers.push(window.setTimeout(() => viewer.scene.globe.tilesLoaded && finish(), 700))
  timers.push(window.setTimeout(finish, 10_000))
  return cleanup
}

// Draws the globe once into a small square image (centre of the view).
// render() right before drawImage() is needed: a WebGL canvas is cleared after it is shown.
function snapshotGlobe(viewer: Viewer): string | null {
  viewer.scene.render()
  const source = viewer.scene.canvas
  const size = Math.min(source.width, source.height)
  if (size === 0) return null
  const out = document.createElement('canvas')
  out.width = 320
  out.height = 320
  const context = out.getContext('2d')
  if (!context) return null
  context.drawImage(source, (source.width - size) / 2, (source.height - size) / 2, size, size, 0, 0, 320, 320)
  return out.toDataURL('image/jpeg', 0.8)
}

type ZoneImage = { siteId: string; url: string }

type MoonGlobeProps = {
  selectedSiteId: string | null
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  onSelectSite: (siteId: string) => void
  onOpenSkyView: (siteId: string) => void
  // "Horizon view anywhere": open the Horizon view at a picked point (lon east 0..360).
  onOpenPointView: (point: { latDeg: number; lonDeg: number }) => void
  // Layer and requirements live in the app, so the assistant can read and set them.
  layerId: string
  onLayerChange: (id: string) => void
  requirementsOn: boolean
  onRequirementsOnChange: (on: boolean) => void
  criteria: Criteria
  onCriteriaChange: (criteria: Criteria) => void
  // A site the assistant asked to show: select it and fly over it (new object = new request).
  flyRequest: { siteId: string } | { point: { latDeg: number; lonDeg: number } } | null
  // Pin menu "Compare": add this point to the Compare tab.
  onComparePoint: (point: { latDeg: number; lonDeg: number }) => void
}

// Orbital view: smooth Moon sphere with NASA imagery. Cesium loads only the
// tiles it needs for the current zoom. One map layer is shown at a time.
export default function MoonGlobe({
  selectedSiteId,
  timeMs,
  onTimeChange,
  stayDays,
  onStayDaysChange,
  onSelectSite,
  onOpenSkyView,
  onOpenPointView,
  layerId,
  onLayerChange: setLayerId,
  requirementsOn,
  onRequirementsOnChange: setRequirementsOn,
  criteria,
  onCriteriaChange: setCriteria,
  flyRequest,
  onComparePoint,
}: MoonGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const overlaysRef = useRef<ImageryLayer[]>([])
  const cancelCaptureRef = useRef<(() => void) | null>(null)
  // Latest "select a site" action for the Cesium click handler (created once).
  const showZoneRef = useRef<(siteId: string) => void>(() => {})
  const [picked, setPicked] = useState<Picked | null>(null)
  const [markerFilter, setMarkerFilter] = useState<MarkerFilter>(DEFAULT_MARKER_FILTER)
  const places = usePlaces()
  const [pinMenu, setPinMenu] = useState<PinMenu | null>(null)
  const overMenuRef = useRef(false)
  const hideMenuTimerRef = useRef<number | null>(null)
  const [zoneImage, setZoneImage] = useState<ZoneImage | null>(null)
  const [zonePending, setZonePending] = useState(false)
  const [requirementsData, setRequirementsData] = useState<RequirementsData | null>(null)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)
  const [zoneData, setZoneData] = useState<{ grid: ZoneGrid; ephemeris: Ephemeris } | null>(null)
  const zonePrimitiveRef = useRef<Primitive | null>(null)
  // Whole-Moon slope table; null = files not built yet. `undefined` = still loading.
  const [globalSlopes, setGlobalSlopes] = useState<{ coarse: GlobalSlope | null; fine: FineSlope | null } | undefined>(
    undefined,
  )
  const globalLayerRef = useRef<ImageryLayer | null>(null)

  // Zone grid (about 1 MB) and ephemeris (50 KB), only when requirements are on.
  useEffect(() => {
    if (!requirementsOn || zoneData) return
    let cancelled = false
    Promise.all([loadZoneGrid(), loadEphemeris()])
      .then(([grid, ephemeris]) => {
        if (!cancelled) setZoneData({ grid, ephemeris })
      })
      .catch((error: unknown) => {
        if (!cancelled) setRequirementsError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [requirementsOn, zoneData])

  // Heavy work follows these deferred copies, so sliders stay smooth while the
  // map catches up a moment later.
  const deferredTimeMs = useDeferredValue(timeMs)
  const deferredStayDays = useDeferredValue(stayDays)
  const deferredCriteria = useDeferredValue(criteria)

  // Zone Sun/Earth shares (the slow part) run in a Web Worker; thresholds are
  // applied here, so moving a threshold is instant.
  const zoneShares = useZoneShares(requirementsOn, deferredTimeMs, deferredStayDays)
  const zoneResults = useMemo(() => {
    if (!requirementsOn || !zoneData || !zoneShares.shares) return null
    return classifyZones(zoneData.grid, zoneShares.shares, deferredCriteria)
  }, [requirementsOn, zoneData, zoneShares.shares, deferredCriteria])

  // Draw the cells while requirements are on; remove them when off.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !requirementsOn || !zoneData) return
    const primitive = addZonePrimitive(viewer, zoneData.grid)
    zonePrimitiveRef.current = primitive
    return () => {
      if (!viewer.isDestroyed()) removeZonePrimitive(viewer, primitive)
      zonePrimitiveRef.current = null
    }
  }, [requirementsOn, zoneData])

  useEffect(() => {
    const viewer = viewerRef.current
    const primitive = zonePrimitiveRef.current
    if (viewer && primitive && zoneResults) colorZones(viewer, primitive, zoneResults, deferredCriteria)
  }, [zoneResults, deferredCriteria])

  // Whole-Moon slope, only when requirements are on: the 2 km table (16.6 MB)
  // when it exists, else the 0.5° table (8 MB).
  useEffect(() => {
    if (!requirementsOn || globalSlopes !== undefined) return
    let cancelled = false
    loadFineSlope()
      .then(async (fine) => ({ fine, coarse: fine ? null : await loadGlobalSlope() }))
      .then((slopes) => {
        if (!cancelled) setGlobalSlopes(slopes)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setGlobalSlopes({ coarse: null, fine: null })
        setRequirementsError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [requirementsOn, globalSlopes])

  // Whole-Moon cells (smooth sphere, no terrain horizon). Sun/Earth shares are
  // recomputed only when the arrival or the stay changes (about 50 ms for 6.5
  // days, on 0.5° cells); thresholds only re-classify them.
  const globalShares = useMemo(() => {
    if (!requirementsOn || !zoneData || globalSlopes === undefined) return null
    return computeGlobalShares(zoneData.ephemeris, deferredTimeMs, deferredStayDays, globalSlopes.coarse?.cellDeg)
  }, [requirementsOn, zoneData, globalSlopes, deferredTimeMs, deferredStayDays])
  const globalCells = useMemo(() => {
    if (!globalShares || globalSlopes === undefined) return null
    return { result: classifyGlobal(globalShares, deferredCriteria, globalSlopes.coarse, globalSlopes.fine) }
  }, [globalShares, globalSlopes, deferredCriteria])

  // Draw them as map tiles under the south pole zone cells; redraw on every change.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !globalCells) return
    const layer = addGlobalLayer(viewer, globalCells.result, deferredCriteria)
    globalLayerRef.current = layer
    return () => {
      if (layer && !viewer.isDestroyed()) removeGlobalLayer(viewer, layer)
      globalLayerRef.current = null
    }
  }, [globalCells, deferredCriteria])

  // Requirements need the small files of every site (about 0.4 MB each) and the slopes.
  useEffect(() => {
    if (!requirementsOn || requirementsData) return
    let cancelled = false
    const withData = SITES.filter((s) => s.hasSkyData)
    Promise.all([Promise.all(withData.map((s) => loadSiteLight(s.id))), loadSiteSlopes()])
      .then(([lights, slopes]) => {
        if (cancelled) return
        setRequirementsData({ lights: Object.fromEntries(withData.map((s, i) => [s.id, lights[i]])), slopes })
      })
      .catch((error: unknown) => {
        if (!cancelled) setRequirementsError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [requirementsOn, requirementsData])

  const results = useMemo(() => {
    if (!requirementsOn || !requirementsData) return null
    return Object.entries(requirementsData.lights).map(([siteId, light]) =>
      evaluateSite(siteId, light, requirementsData.slopes[siteId] ?? null, deferredCriteria, deferredTimeMs, deferredStayDays),
    )
  }, [requirementsOn, requirementsData, deferredCriteria, deferredTimeMs, deferredStayDays])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Must be set before the viewer is created: the globe uses the Moon (1737.4 km).
    Ellipsoid.default = Ellipsoid.MOON

    const viewer = new Viewer(container, {
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      skyBox: new SkyBox({
        sources: {
          positiveX: '/textures/stars/tycho2t3_80_px.jpg',
          negativeX: '/textures/stars/tycho2t3_80_mx.jpg',
          positiveY: '/textures/stars/tycho2t3_80_py.jpg',
          negativeY: '/textures/stars/tycho2t3_80_my.jpg',
          positiveZ: '/textures/stars/tycho2t3_80_pz.jpg',
          negativeZ: '/textures/stars/tycho2t3_80_mz.jpg',
        },
      }),
      skyAtmosphere: false,
      // Draw only when something changes (saves GPU and battery).
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    })
    viewerRef.current = viewer
    viewer.scene.backgroundColor.alpha = 1
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.globe.enableLighting = false
    if (viewer.scene.sun) viewer.scene.sun.show = false
    if (viewer.scene.moon) viewer.scene.moon.show = false

    // Render on demand still has to redraw while tiles arrive, or finer tiles
    // can stay hidden until the next mouse move.
    const removeTileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() =>
      viewer.scene.requestRender(),
    )

    // The photo mosaic is the base. Map layers are drawn over it.
    viewer.imageryLayers.addImageryProvider(makeProvider(photoBase))

    // Start above the near side, looking straight down at the Moon.
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 0, 6_000_000, Ellipsoid.MOON),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    })

    // Site markers. Labels appear only when the camera is close, so the three
    // south pole sites (about 15 km apart) do not overlap from far away.
    SITES.forEach((site, index) => {
      viewer.entities.add({
        id: site.id,
        position: Cartesian3.fromDegrees(site.longitudeDeg, site.latitudeDeg, 0, Ellipsoid.MOON),
        point: { pixelSize: 9, color: SITE_COLOR, outlineColor: Color.BLACK, outlineWidth: 1.5 },
        label: {
          text: site.name,
          font: '13px sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          // Alternate above / below so close sites do not cover each other.
          verticalOrigin: index % 2 === 0 ? VerticalOrigin.BOTTOM : VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, index % 2 === 0 ? -10 : 10),
          distanceDisplayCondition: LABEL_NEAR,
        },
      })
    })

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      const hit: unknown = viewer.scene.pick(event.position)
      if (typeof hit === 'object' && hit !== null && 'id' in hit && hit.id instanceof Entity) {
        const entityId = hit.id.id
        if (entityId.startsWith('pin:')) {
          setPinMenu({ placeId: entityId.slice(4), x: event.position.x, y: event.position.y })
          return
        }
        showZoneRef.current(entityId)
        return
      }
      setPinMenu(null)
      // A zone cell (primitive id "cell-<n>") is reported with its results.
      const cellMatch =
        typeof hit === 'object' && hit !== null && 'id' in hit && typeof hit.id === 'string' ? /^cell-(\d+)$/.exec(hit.id) : null
      const cartesian = viewer.camera.pickEllipsoid(event.position, Ellipsoid.MOON)
      if (!cartesian) {
        setPicked(null)
        return
      }
      const cartographic = Cartographic.fromCartesian(cartesian, Ellipsoid.MOON)
      const longitude = CesiumMath.toDegrees(cartographic.longitude)
      setPicked({
        latitudeDeg: CesiumMath.toDegrees(cartographic.latitude),
        // The app uses degrees east, 0 to 360 (Shackleton rim = 203.97° E).
        longitudeDeg: ((longitude % 360) + 360) % 360,
        cell: cellMatch ? Number(cellMatch[1]) : null,
      })
    }, ScreenSpaceEventType.LEFT_CLICK)

    // Hovering a site marker shows its name at any zoom, with a pointer cursor.
    let hovered: string | null = null
    handler.setInputAction((event: ScreenSpaceEventHandler.MotionEvent) => {
      const hit: unknown = viewer.scene.pick(event.endPosition)
      const id = typeof hit === 'object' && hit !== null && 'id' in hit && hit.id instanceof Entity ? hit.id.id : null
      if (id?.startsWith('pin:')) {
        if (hideMenuTimerRef.current !== null) window.clearTimeout(hideMenuTimerRef.current)
        hideMenuTimerRef.current = null
        const pos = event.endPosition
        const placeId = id.slice(4)
        setPinMenu((m) => (m && m.placeId === placeId ? m : { placeId, x: pos.x, y: pos.y }))
      } else if (hovered?.startsWith('pin:') && hideMenuTimerRef.current === null) {
        // Leaving a pin: close its menu unless the cursor moves onto the menu.
        hideMenuTimerRef.current = window.setTimeout(() => {
          hideMenuTimerRef.current = null
          if (!overMenuRef.current) setPinMenu(null)
        }, 400)
      }
      if (id === hovered) return
      hovered = id
      showHoverLabel(viewer, id)
      viewer.scene.canvas.style.cursor = id ? 'pointer' : ''
    }, ScreenSpaceEventType.MOUSE_MOVE)

    return () => {
      cancelCaptureRef.current?.()
      removeTileListener()
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
      overlaysRef.current = []
    }
  }, [])

  // Swap the overlay when the selected layer changes: the previous one is removed first.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    for (const layer of overlaysRef.current) viewer.imageryLayers.remove(layer, true)
    overlaysRef.current = getLayer(layerId).sources.map((source) =>
      viewer.imageryLayers.addImageryProvider(makeProvider(source)),
    )
    if (globalLayerRef.current) raiseGlobalLayer(viewer, globalLayerRef.current)
    viewer.scene.requestRender()
  }, [layerId])

  // Highlight the selected site marker.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    highlightSite(viewer, selectedSiteId, results ? Object.fromEntries(results.map((r) => [r.siteId, r.meets])) : null)
  }, [selectedSiteId, results])

  // Fly to a site, then take a snapshot of the zone for the Topography preview.
  function flyAndCapture(siteId: string, altitudeM: number) {
    const viewer = viewerRef.current
    if (!viewer) return
    cancelCaptureRef.current?.()
    setZonePending(true)
    let cancelled = false
    let stopWaiting = () => {}
    cancelCaptureRef.current = () => {
      cancelled = true
      stopWaiting()
    }
    flyOver(viewer, siteId, altitudeM, () => {
      if (cancelled) return
      stopWaiting = whenTilesLoaded(viewer, () => {
        if (cancelled) return
        const url = snapshotGlobe(viewer)
        if (url) setZoneImage({ siteId, url })
        setZonePending(false)
      })
    })
  }

  // Picking a site (list or marker) selects it and flies over it.
  function showZone(siteId: string) {
    onSelectSite(siteId)
    flyAndCapture(siteId, ZONE_ALTITUDE_M)
  }

  // Topography view: closer to the ground, on a layer that shows relief.
  function openTopography(siteId: string) {
    if (layerId === 'image') setLayerId('hillshade')
    flyAndCapture(siteId, TOPOGRAPHY_ALTITUDE_M)
  }

  function zoomOut() {
    const viewer = viewerRef.current
    if (!viewer || !selectedSiteId) return
    cancelCaptureRef.current?.()
    setZonePending(false)
    flyOver(viewer, selectedSiteId, GLOBE_ALTITUDE_M)
  }

  useEffect(() => {
    showZoneRef.current = showZone
  })

  // Fly when the assistant selects a site, or to a saved place. Runs after the viewer exists.
  useEffect(() => {
    if (!flyRequest) return
    if ('siteId' in flyRequest) {
      showZoneRef.current(flyRequest.siteId)
      return
    }
    const viewer = viewerRef.current
    if (!viewer) return
    const { latDeg, lonDeg } = flyRequest.point
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(lonDeg, latDeg, ZONE_ALTITUDE_M, Ellipsoid.MOON),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 2,
    })
    setPicked({ latitudeDeg: latDeg, longitudeDeg: lonDeg, cell: null })
  }, [flyRequest])

  // Pins and marker filters follow their state.
  useEffect(() => {
    const viewer = viewerRef.current
    if (viewer) syncPins(viewer, places, markerFilter.pins)
  }, [places, markerFilter.pins])

  useEffect(() => {
    const viewer = viewerRef.current
    if (viewer) applyMarkerFilter(viewer, markerFilter)
  }, [markerFilter])

  // Zoom buttons: halve or double the camera height.
  function zoomBy(factor: number) {
    const viewer = viewerRef.current
    if (!viewer) return
    const height = viewer.camera.positionCartographic.height
    if (factor < 1) viewer.camera.zoomIn(height * (1 - factor))
    else viewer.camera.zoomOut(Math.max(0, Math.min(height * (factor - 1), 20_000_000 - height)))
    viewer.scene.requestRender()
  }

  const menuPlace = pinMenu ? places.find((p) => p.id === pinMenu.placeId) ?? null : null

  const active = getLayer(layerId)
  const selectedSite = selectedSiteId ? getSite(selectedSiteId) : null

  return (
    <div className="relative h-full min-w-0 flex-1 bg-black">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="3D Moon globe. Drag to rotate, scroll to zoom, click a site marker to select it."
      />
      <div className="absolute left-4 top-4 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-3 overflow-y-auto">
        <div className="rounded-lg border border-[#444] bg-[#303030] p-3 text-gray-100 shadow-lg">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
            Orbital view
          </h1>
          <p className="mt-1 text-[11px] text-gray-400">
            Click the Moon to pick a point, then add a pin or open its Horizon view. Map layers: bottom left.
          </p>
        </div>
        <RequirementsPanel
          enabled={requirementsOn}
          onEnabledChange={setRequirementsOn}
          criteria={criteria}
          onCriteriaChange={setCriteria}
          results={results}
          error={requirementsError ?? zoneShares.error}
          zoneSummary={
            zoneResults && zoneData
              ? {
                  meets: zoneResults.filter((r) => r.meets).length,
                  total: zoneResults.length,
                  cellKm: zoneData.grid.cellSizeM / 1000,
                }
              : null
          }
          globalSummary={
            globalCells
              ? {
                  meets: globalCells.result.meetsCount,
                  total: globalCells.result.totalCells,
                  cellLabel: globalCells.result.fine ? 'about 2 km' : `${globalCells.result.cellDeg}°`,
                  hasSlope: globalCells.result.hasSlope,
                }
              : null
          }
        />
      </div>
      <SitePanel
        selected={selectedSite}
        timeMs={timeMs}
        onTimeChange={onTimeChange}
        stayDays={stayDays}
        onStayDaysChange={onStayDaysChange}
        zoneImageUrl={zoneImage && zoneImage.siteId === selectedSiteId ? zoneImage.url : null}
        zonePending={zonePending}
        onSelect={showZone}
        onOpenSkyView={onOpenSkyView}
        onOpenTopography={openTopography}
        onZoomOut={zoomOut}
      />
      {picked && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-[#303030]/90 px-3 py-2 text-sm text-gray-100">
          <p className="text-xs text-gray-400">Picked point</p>
          <p>
            {picked.latitudeDeg.toFixed(4)}°, {picked.longitudeDeg.toFixed(2)}° E
          </p>
          {picked.cell !== null && zoneResults?.[picked.cell] && (
            <p className="mt-1 text-xs text-gray-300">
              Zone cell (best of its highest spots): {zoneResults[picked.cell].meets ? '✓ meets' : '✕ excluded'} · Sun{' '}
              {zoneResults[picked.cell].sunPercent.toFixed(0)}% · Earth {zoneResults[picked.cell].earthPercent.toFixed(0)}% ·{' '}
              {zoneResults[picked.cell].slopeAreaPercent}% of area under {criteria.slope.maxDeg}°
            </p>
          )}
          {picked.cell === null &&
            globalCells &&
            (() => {
              const r = globalCells.result
              const k = globalCellIndex(r, picked.latitudeDeg, picked.longitudeDeg)
              const fine = globalSlopes?.fine ?? null
              let slopeText = 'slope n/a'
              if (fine) {
                const p90 = fineSlopeAt(fine, picked.latitudeDeg, picked.longitudeDeg)
                slopeText = p90 === null ? `${fine.areaPercent}% of 2 km cell under: steeper than 31°` : `${fine.areaPercent}% of 2 km cell under ${p90}°`
              } else {
                const share = globalSlopeShare(globalSlopes?.coarse ?? null, k, criteria.slope.maxDeg)
                if (share !== null) slopeText = `${share}% of area under ${criteria.slope.maxDeg}°`
              }
              return (
                <p className="mt-1 text-xs text-gray-300">
                  Whole-Moon point (smooth sphere): {meetsAt(r, picked.latitudeDeg, picked.longitudeDeg) ? '✓ meets' : '✕ excluded'} ·
                  Sun {r.sunPercent[k].toFixed(0)}% · Earth {r.earthPercent[k].toFixed(0)}% · {slopeText}
                </p>
              )
            })()}
          <button
            type="button"
            onClick={() => {
              addPlace(picked.latitudeDeg, picked.longitudeDeg)
              setMarkerFilter((f) => (f.pins ? f : { ...f, pins: true }))
            }}
            className="mt-2 w-full rounded border border-[#666] px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-[#3a3a3a]"
            title="Save this point as a pin (listed under Saved places)"
          >
            📍 Add pin
          </button>
          {(() => {
            const cover = coverage(picked.latitudeDeg)
            return cover.ok ? (
              <button
                type="button"
                onClick={() => onOpenPointView({ latDeg: picked.latitudeDeg, lonDeg: picked.longitudeDeg })}
                className="mt-2 w-full rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-950 hover:bg-white"
                title={`Computed in your browser from NASA ${cover.label}`}
              >
                Open Horizon view here
              </button>
            ) : (
              <p className="mt-2 max-w-xs text-[11px] text-gray-400">{cover.reason}</p>
            )
          })()}
        </div>
      )}
      <LayerControl activeId={layerId} onChange={setLayerId} filter={markerFilter} onFilterChange={setMarkerFilter} />
      <div className="absolute right-[19.5rem] top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[#444] bg-[#303030]/95 shadow-lg">
        <button type="button" onClick={() => zoomBy(0.5)} aria-label="Zoom in" title="Zoom in" className="h-9 w-9 text-lg text-gray-100 hover:bg-[#3a3a3a]">
          +
        </button>
        <div className="h-px bg-[#444]" />
        <button type="button" onClick={() => zoomBy(2)} aria-label="Zoom out" title="Zoom out" className="h-9 w-9 text-lg text-gray-100 hover:bg-[#3a3a3a]">
          −
        </button>
      </div>
      {pinMenu && menuPlace && (
        <div
          role="dialog"
          aria-label={`Pin ${menuPlace.name}`}
          onMouseEnter={() => {
            overMenuRef.current = true
          }}
          onMouseLeave={() => {
            overMenuRef.current = false
            setPinMenu(null)
          }}
          className="absolute z-20 w-56 -translate-x-1/2 rounded-lg border border-[#555] bg-[#202020]/97 p-2.5 text-gray-100 shadow-2xl"
          style={{ left: pinMenu.x, top: Math.max(8, pinMenu.y - 150) }}
        >
          <p className="truncate text-sm font-medium">{menuPlace.name}</p>
          <p className="text-[11px] text-gray-400">{formatCoords(menuPlace.latDeg, menuPlace.lonDeg)}</p>
          {(() => {
            const cover = coverage(menuPlace.latDeg)
            const point = { latDeg: menuPlace.latDeg, lonDeg: menuPlace.lonDeg }
            return cover.ok ? (
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => onOpenPointView(point)} className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-950 hover:bg-white">
                  Horizon view
                </button>
                <button type="button" onClick={() => onComparePoint(point)} className="flex-1 rounded border border-[#666] px-2 py-1 text-xs hover:bg-[#3a3a3a]">
                  Compare
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-gray-400">{cover.reason}</p>
            )
          })()}
        </div>
      )}
      <p className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-gray-400">
        NASA Moon Trek · {active.credit}
      </p>
    </div>
  )
}
