import { maxFovDeg, minFovDeg } from '../scene/viewLimits'

type ViewControlsProps = {
  fovDeg: number
  // Multiplies the current field of view (< 1 zooms in).
  onZoom: (factor: number) => void
  onLookAtSun: () => void
  onLookAtEarth: () => void
}

const buttonClassName =
  'rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-40'

// Zoom and quick-aim buttons for the 3D view. Zoom only narrows the field of
// view (like binoculars); the Sun and Earth keep their real angular size.
export function ViewControls({ fovDeg, onZoom, onLookAtSun, onLookAtEarth }: ViewControlsProps) {
  const magnification = maxFovDeg / fovDeg
  return (
    <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" className={buttonClassName} onClick={onLookAtSun}>
          Look at Sun
        </button>
        <button type="button" className={buttonClassName} onClick={onLookAtEarth}>
          Look at Earth
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          className={buttonClassName}
          disabled={fovDeg >= maxFovDeg}
          onClick={() => onZoom(1.6)}
        >
          −
        </button>
        <span className="min-w-28 text-center text-xs text-white/80">
          FOV {fovDeg < 10 ? fovDeg.toFixed(1) : Math.round(fovDeg)}° · ×{magnification.toFixed(1)}
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          className={buttonClassName}
          disabled={fovDeg <= minFovDeg}
          onClick={() => onZoom(1 / 1.6)}
        >
          +
        </button>
      </div>
    </div>
  )
}
