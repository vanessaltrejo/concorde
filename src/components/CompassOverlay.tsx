type CompassOverlayProps = {
  azimuthDeg: number
}

const directionLabels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function directionLabel(azimuthDeg: number): string {
  const index = Math.round(azimuthDeg / 45) % directionLabels.length
  return directionLabels[index]
}

export function CompassOverlay({ azimuthDeg }: CompassOverlayProps) {
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/10 px-3 py-1 text-sm text-white">
      Heading {Math.round(azimuthDeg)}° {directionLabel(azimuthDeg)}
    </div>
  )
}
