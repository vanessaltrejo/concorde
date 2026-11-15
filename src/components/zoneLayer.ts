import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  Ellipsoid,
  GeometryInstance,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  Primitive,
  type Viewer,
} from 'cesium'
import type { ZoneGrid, ZoneResult } from '../scene/zones'
import { greenRgba, type Criteria } from '../scene/requirements'

// Zone cells drawn as flat polygons slightly above the smooth Moon sphere.
// Cesium objects are mutable by design, so the mutations live here
// (same pattern as the Horizon view, PROJECT_MEMORY problem #22).

const EXCLUDED = Color.fromCssColorString('#8a8a8a').withAlpha(0.12)
const HEIGHT_M = 150 // above the sphere so the cells do not flicker with it

function cellId(index: number): string {
  return `cell-${index}`
}

export function addZonePrimitive(viewer: Viewer, grid: ZoneGrid): Primitive {
  const instances = grid.cells.map(
    (cell, i) =>
      new GeometryInstance({
        id: cellId(i),
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(cell.corners.flat(), Ellipsoid.MOON)),
          ellipsoid: Ellipsoid.MOON,
          height: HEIGHT_M,
        }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(EXCLUDED) },
      }),
  )
  const primitive = new Primitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
    asynchronous: false,
  })
  viewer.scene.primitives.add(primitive)
  viewer.scene.requestRender()
  return primitive
}

// Colour every cell; waits for the primitive's first draw if needed.
export function colorZones(viewer: Viewer, primitive: Primitive, results: ZoneResult[], criteria: Criteria): void {
  const apply = () => {
    results.forEach((r, i) => {
      const attributes = primitive.getGeometryInstanceAttributes(cellId(i))
      // Bluish green, shading to yellow when the Sun share is closer to the user's limit.
      let colour = EXCLUDED
      if (r.meets) {
        const [red, green, blue, alpha] = greenRgba(r.sunPercent, criteria)
        colour = Color.fromBytes(red, green, blue, Math.round(255 * alpha))
      }
      if (attributes) attributes.color = ColorGeometryInstanceAttribute.toValue(colour)
    })
    viewer.scene.requestRender()
  }
  if (primitive.ready) {
    apply()
    return
  }
  const stop = viewer.scene.postRender.addEventListener(() => {
    if (!primitive.ready) return
    stop()
    apply()
  })
  viewer.scene.requestRender()
}

export function removeZonePrimitive(viewer: Viewer, primitive: Primitive): void {
  viewer.scene.primitives.remove(primitive)
  viewer.scene.requestRender()
}
