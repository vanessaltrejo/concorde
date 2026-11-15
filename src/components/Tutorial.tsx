import { useEffect, useState } from 'react'
import type { TabId } from './NavRail'

// Guided tour for guests: the page dims and the element being explained stays
// bright inside a yellow frame, with a card next to it.
export type TutorialStep = {
  tab: TabId | null
  // CSS selector of the element to highlight; no match = centered card only.
  target: string | null
  title: string
  text: string
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { tab: 'dashboard', target: 'nav[aria-label="Main navigation"]', title: 'Pages', text: 'Use these icons to move between pages. Hover an icon to see its name.' },
  { tab: 'dashboard', target: 'button[aria-label="Site"]', title: 'Dashboard', text: 'Pick a site here. The page shows how much Sun and Earth link you get during your stay.' },
  { tab: 'orbital', target: '[data-tour="requirements"]', title: 'Requirements', text: 'Choose what a good site needs. Pins turn green when a site meets it and gray when it does not.' },
  { tab: 'orbital', target: '[data-tour="site-panel"]', title: 'Registered landing sites', text: 'Choose a site or a saved place to see its date, stay, Sun and Earth, and a 2D horizon. Click the Moon to pick any point and save it.' },
  { tab: 'orbital', target: 'button[aria-label="Map layers"]', title: 'Layers', text: 'Change the map (photo, topography, slope, temperature) and choose which markers show.' },
  { tab: 'horizon', target: '[data-tour="horizon-panel"]', title: 'Horizon view', text: 'The sky from the surface: when the Sun and Earth are visible and when terrain hides them.' },
  { tab: 'horizon', target: '[data-tour="view-controls"]', title: 'Look around', text: 'Aim at the Sun or the Earth and zoom. You can also drag the 3D view.' },
  { tab: 'compare', target: '[data-tour="compare-add"]', title: 'Compare', text: 'Add up to three sites, saved places or dates and see which one fits your goal.' },
  { tab: 'references', target: 'nav button[aria-label="References"]', title: 'References', text: 'Every source and method behind the numbers, and what each one is used for.' },
  { tab: null, target: 'button[aria-label="Open assistant"], button[aria-label="Minimize assistant"]', title: 'Assistant', text: 'The blue chat button answers questions and can change the app for you. Ask it anything.' },
]

type Box = { left: number; top: number; width: number; height: number }
const PAD = 6
const CARD_W = 352

function measure(selector: string | null): Box | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

type TutorialProps = {
  step: number
  onStep: (step: number) => void
  onClose: () => void
}

export function Tutorial({ step, onStep, onClose }: TutorialProps) {
  const current = TUTORIAL_STEPS[step]
  const last = step === TUTORIAL_STEPS.length - 1
  const [box, setBox] = useState<Box | null>(null)

  // The page may still be loading or moving (panels slide), so the box is
  // measured again a few times per second.
  useEffect(() => {
    const read = () =>
      setBox((previous) => {
        const next = measure(current.target)
        if (!next || !previous) return next
        const same = ['left', 'top', 'width', 'height'].every((k) => Math.abs(next[k as keyof Box] - previous[k as keyof Box]) < 1)
        return same ? previous : next
      })
    read()
    const timer = window.setInterval(read, 250)
    return () => window.clearInterval(timer)
  }, [current.target, step])

  const vw = window.innerWidth
  const vh = window.innerHeight
  // Card beside the highlighted element: right, left, below or above, whichever fits.
  let card: { left: number; top: number } = { left: (vw - CARD_W) / 2, top: vh / 2 - 90 }
  if (box) {
    const room = { right: vw - (box.left + box.width), left: box.left, below: vh - (box.top + box.height), above: box.top }
    if (room.right >= CARD_W + 24) card = { left: box.left + box.width + PAD + 16, top: box.top }
    else if (room.left >= CARD_W + 24) card = { left: box.left - PAD - 16 - CARD_W, top: box.top }
    else if (room.below >= 200) card = { left: box.left, top: box.top + box.height + PAD + 16 }
    else card = { left: box.left, top: Math.max(8, box.top - PAD - 16 - 190) }
    card = {
      left: Math.max(8, Math.min(card.left, vw - CARD_W - 8)),
      top: Math.max(8, Math.min(card.top, vh - 230)),
    }
  }

  return (
    <div role="dialog" aria-label="Tutorial" className="fixed inset-0 z-[70]">
      {/* Blocks clicks on the page behind the tour. */}
      <div className="absolute inset-0" />
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl outline outline-2 outline-[#FFD400] transition-all duration-200"
          style={{
            left: box.left - PAD,
            top: box.top - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/70" />
      )}
      <div
        className="absolute rounded-lg border border-[#555] bg-[#303030] p-4 text-gray-100 shadow-2xl transition-all duration-200"
        style={{ left: card.left, top: card.top, width: CARD_W }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            Tutorial · {step + 1} of {TUTORIAL_STEPS.length}
          </p>
          <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-white">
            Skip
          </button>
        </div>
        <h2 className="mt-1 flex items-center gap-2 text-base font-semibold">
          <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-gray-300">{current.text}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => onStep(step - 1)} disabled={step === 0} className="text-sm text-gray-300 hover:text-white disabled:invisible">
            Back
          </button>
          <button
            type="button"
            onClick={() => (last ? onClose() : onStep(step + 1))}
            className="rounded bg-[#FFD400] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
