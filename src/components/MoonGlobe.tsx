import { useEffect, useRef, useState } from 'react'
import {
  Cartographic,
  Ellipsoid,
  GeographicTilingScheme,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  DistanceDisplayCondition,
  Entity,
  LabelStyle,
  VerticalOrigin,
  ConstantProperty,
  type ImageryLayer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { getLayer, photoBase, tileUrl, type TileSource } from '../data/layers'
import { getSite, SITES } from '../data/sites'
import { LayerSelector } from './LayerSelector'
import { SitePanel } from './SitePanel'

type Picked = { latitudeDeg: number; longitudeDeg: number }

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
const SELECTED_COLOR = Color.WHITE

// Cesium objects are mutable by design; the mutation lives in a helper
// (same pattern as the Horizon view, PROJECT_MEMORY problem #22).
function highlightSite(viewer: Viewer, siteId: string | null) {
  for (const entity of viewer.entities.values) {
    if (entity.point) entity.point.color = new ConstantProperty(entity.id === siteId ? SELECTED_COLOR : SITE_COLOR)
  }
  viewer.scene.requestRender()
}

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
}: MoonGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const overlaysRef = useRef<ImageryLayer[]>([])
  const cancelCaptureRef = useRef<(() => void) | null>(null)
  // Latest "select a site" action for the Cesium click handler (created once).
  const showZoneRef = useRef<(siteId: string) => void>(() => {})
  const [picked, setPicked] = useState<Picked | null>(null)
  const [layerId, setLayerId] = useState('image')
  const [zoneImage, setZoneImage] = useState<ZoneImage | null>(null)
  const [zonePending, setZonePending] = useState(false)

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
      skyBox: false,
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
          distanceDisplayCondition: new DistanceDisplayCondition(0, 400_000),
        },
      })
    })

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      const hit: unknown = viewer.scene.pick(event.position)
      if (typeof hit === 'object' && hit !== null && 'id' in hit && hit.id instanceof Entity) {
        showZoneRef.current(hit.id.id)
        return
      }
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
      })
    }, ScreenSpaceEventType.LEFT_CLICK)

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
    viewer.scene.requestRender()
  }, [layerId])

  // Highlight the selected site marker.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    highlightSite(viewer, selectedSiteId)
  }, [selectedSiteId])

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

  const active = getLayer(layerId)
  const selectedSite = selectedSiteId ? getSite(selectedSiteId) : null

  return (
    <div className="relative h-full min-w-0 flex-1 bg-black">
      <div ref={containerRef} className="h-full w-full" />
      <LayerSelector activeId={layerId} onChange={setLayerId} />
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
        </div>
      )}
      <p className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-gray-400">
        NASA Moon Trek · {active.credit}
      </p>
    </div>
  )
}
