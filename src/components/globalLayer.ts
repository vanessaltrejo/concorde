import {
  Ellipsoid,
  Event,
  GeographicTilingScheme,
  ImageryLayer,
  type ImageryProvider,
  TextureMagnificationFilter,
  TextureMinificationFilter,
  type Viewer,
} from 'cesium'
import type { GlobalResult } from '../scene/globalCells'
import { greenRgba, type Criteria } from '../scene/requirements'

// Whole-Moon cells drawn as map tiles made in the browser. Cesium asks only for
// the tiles it shows, at the detail of the current zoom, so the 2 km slope
// cells (16.6 million) cost no more than the visible part of the screen.
// Same colours as the south pole zone cells (zoneLayer.ts): bluish green to
// yellow = meets (greenRgba in requirements.ts), faint gray = excluded.
// Cesium objects are mutable by design, so the mutations live here.

const EXCLUDED_RGBA: [number, number, number, number] = [0x8a, 0x8a, 0x8a, 0.12] // faint gray, 12 % opaque
const TILE = 256
// Level 6 tiles have pixels of about 0.011°, so a 2 km cell (1/16°) spans about
// 6 pixels; closer views reuse level 6 with sharp edges.
const MAX_LEVEL = 6

// RGBA of every 0.5° cell when it meets the requirements (Sun share sets the colour).
function cellColours(result: GlobalResult, criteria: Criteria): Uint8ClampedArray {
  const colours = new Uint8ClampedArray(result.sunPercent.length * 4)
  for (let k = 0; k < result.sunPercent.length; k++) {
    const [r, g, b, a] = greenRgba(result.sunPercent[k], criteria)
    colours[k * 4] = r
    colours[k * 4 + 1] = g
    colours[k * 4 + 2] = b
    colours[k * 4 + 3] = Math.round(255 * a)
  }
  return colours
}

function makeProvider(result: GlobalResult, criteria: Criteria): ImageryProvider {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON })
  const colours = cellColours(result, criteria)
  const gray = EXCLUDED_RGBA.map((v, i) => (i === 3 ? Math.round(255 * v) : v))
  const { cellDeg, cellsLat, cellsLon, sunEarthOk, meets, fine, slopeByte } = result

  function drawTile(x: number, y: number, level: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = TILE
    canvas.height = TILE
    const context = canvas.getContext('2d')
    if (!context) return canvas
    const image = context.createImageData(TILE, TILE)
    const tilesX = tilingScheme.getNumberOfXTilesAtLevel(level)
    const tilesY = tilingScheme.getNumberOfYTilesAtLevel(level)
    const spanLon = 360 / tilesX
    const spanLat = 180 / tilesY
    const west = -180 + x * spanLon
    const north = 90 - y * spanLat
    // Cell column (0.5° and 2 km) of every pixel column; longitudes run 0..360 east.
    const col = new Int32Array(TILE)
    const fineCol = new Int32Array(TILE)
    for (let px = 0; px < TILE; px++) {
      const lon = (((west + ((px + 0.5) * spanLon) / TILE) % 360) + 360) % 360
      col[px] = Math.min(Math.floor(lon / cellDeg), cellsLon - 1)
      if (fine) fineCol[px] = Math.min(Math.floor(lon / fine.cellDeg), fine.cellsLon - 1)
    }
    for (let py = 0; py < TILE; py++) {
      const lat = north - ((py + 0.5) * spanLat) / TILE
      const row = Math.min(Math.max(Math.floor((90 - lat) / cellDeg), 0), cellsLat - 1)
      const fineRow = fine ? Math.min(Math.max(Math.floor((90 - lat) / fine.cellDeg), 0), fine.cellsLat - 1) : 0
      for (let px = 0; px < TILE; px++) {
        const k = row * cellsLon + col[px]
        const ok = fine
          ? sunEarthOk[k] === 1 && fine.p90[fineRow * fine.cellsLon + fineCol[px]] <= slopeByte
          : meets[k] === 1
        const p = (py * TILE + px) * 4
        if (ok) {
          image.data[p] = colours[k * 4]
          image.data[p + 1] = colours[k * 4 + 1]
          image.data[p + 2] = colours[k * 4 + 2]
          image.data[p + 3] = colours[k * 4 + 3]
        } else {
          image.data[p] = gray[0]
          image.data[p + 1] = gray[1]
          image.data[p + 2] = gray[2]
          image.data[p + 3] = gray[3]
        }
      }
    }
    context.putImageData(image, 0, 0)
    return canvas
  }

  // Implements the ImageryProvider interface (Cesium reads these fields).
  const provider = {
    tilingScheme,
    rectangle: tilingScheme.rectangle,
    tileWidth: TILE,
    tileHeight: TILE,
    minimumLevel: 0,
    maximumLevel: MAX_LEVEL,
    tileDiscardPolicy: undefined,
    errorEvent: new Event(),
    credit: undefined,
    proxy: undefined,
    hasAlphaChannel: true,
    getTileCredits: () => [],
    requestImage: (x: number, y: number, level: number) => Promise.resolve(drawTile(x, y, level)),
    pickFeatures: () => undefined,
  }
  return provider as unknown as ImageryProvider
}

// Adds the layer on top of the map layers and returns it.
export function addGlobalLayer(viewer: Viewer, result: GlobalResult, criteria: Criteria): ImageryLayer {
  const layer = new ImageryLayer(makeProvider(result, criteria), {
    // Sharp cell edges instead of a blur between cells.
    magnificationFilter: TextureMagnificationFilter.NEAREST,
    minificationFilter: TextureMinificationFilter.NEAREST,
  })
  viewer.imageryLayers.add(layer)
  viewer.scene.requestRender()
  return layer
}

export function removeGlobalLayer(viewer: Viewer, layer: ImageryLayer): void {
  viewer.imageryLayers.remove(layer, true)
  viewer.scene.requestRender()
}

// Keep the cells above a map layer that was added after them.
export function raiseGlobalLayer(viewer: Viewer, layer: ImageryLayer): void {
  viewer.imageryLayers.raiseToTop(layer)
  viewer.scene.requestRender()
}
