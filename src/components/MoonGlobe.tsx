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
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// Moon Trek WMTS: LRO Wide Angle Camera global mosaic (equirectangular tiles).
// Levels 0 to 8 exist (level 9 returns 404; checked 2026-11-14 in the product's
// WMTSCapabilities.xml and with a tile request).
const WAC_URL =
  'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'
const WAC_MAX_LEVEL = 8

type Picked = { latitudeDeg: number; longitudeDeg: number }

// Orbital view: smooth Moon sphere with NASA imagery. Cesium loads only the
// tiles it needs for the current zoom.
export default function MoonGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)

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
    viewer.scene.backgroundColor.alpha = 1
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.globe.enableLighting = false
    if (viewer.scene.sun) viewer.scene.sun.show = false
    if (viewer.scene.moon) viewer.scene.moon.show = false

    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: WAC_URL,
        tilingScheme: new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON }),
        rectangle: Rectangle.MAX_VALUE,
        maximumLevel: WAC_MAX_LEVEL,
        tileWidth: 256,
        tileHeight: 256,
      }),
    )

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
    }
  }, [])

  return (
    <div className="relative h-full min-w-0 flex-1 bg-black">
      <div ref={containerRef} className="h-full w-full" />
      {picked && (
        <div className="absolute left-4 top-4 rounded bg-[#303030]/90 px-3 py-2 text-sm text-gray-100">
          <p className="text-xs text-gray-400">Picked point</p>
          <p>
            {picked.latitudeDeg.toFixed(4)}°, {picked.longitudeDeg.toFixed(2)}° E
          </p>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-gray-400">
        Imagery: NASA LRO Wide Angle Camera mosaic, via NASA Moon Trek.
      </p>
    </div>
  )
}
