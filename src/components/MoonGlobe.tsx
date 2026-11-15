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
  type ImageryLayer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { getLayer, photoBase, tileUrl, type TileSource } from '../data/layers'
import { LayerSelector } from './LayerSelector'

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

// Orbital view: smooth Moon sphere with NASA imagery. Cesium loads only the
// tiles it needs for the current zoom. One map layer is shown at a time.
export default function MoonGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const overlaysRef = useRef<ImageryLayer[]>([])
  const [picked, setPicked] = useState<Picked | null>(null)
  const [layerId, setLayerId] = useState('image')

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

    // The photo mosaic is the base. Map layers are drawn over it.
    viewer.imageryLayers.addImageryProvider(makeProvider(photoBase))

    // Start above the near side, looking straight down at the Moon.
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 0, 6_000_000, Ellipsoid.MOON),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    })

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
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

  const active = getLayer(layerId)

  return (
    <div className="relative h-full min-w-0 flex-1 bg-black">
      <div ref={containerRef} className="h-full w-full" />
      <LayerSelector activeId={layerId} onChange={setLayerId} />
      {picked && (
        <div className="absolute right-4 top-4 rounded bg-[#303030]/90 px-3 py-2 text-sm text-gray-100">
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
