import { navigate } from './nav'

// Launcher: full-screen Moon footage, the CONCORDEMOON wordmark and one action
// (Execute Concordemoon). Satoshi, white, square buttons with a thin outline.
// Footage: "Tour of the Moon 4K", NASA (science.nasa.gov/resource/tour-of-the-moon-4k).

const FOOTAGE_URL = 'https://science.nasa.gov/resource/tour-of-the-moon-4k/'
// The hero plays (and loops) from this second of the footage.
const LOOP_START_S = 10

// Square, no fill, thin white outline.
const OUTLINE_BUTTON = 'btn-outline px-6 py-2.5 text-sm font-medium'

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={'select-none font-bold tracking-[0.18em] text-white ' + (size === 'lg' ? 'text-2xl' : 'text-lg')}>
      CONCORDEMOON
    </span>
  )
}

export function Landing() {
  const launch = () => navigate('/home')

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-[#151617] text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/moon-tour.m4v"
        poster="/textures/moon-hero.png"
        autoPlay
        muted
        playsInline
        aria-hidden
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = LOOP_START_S
        }}
        onEnded={(e) => {
          e.currentTarget.currentTime = LOOP_START_S
          void e.currentTarget.play()
        }}
      />
      {/* Gray veil so the text reads on any frame of the footage. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(21,22,23,0.72) 0%, rgba(21,22,23,0.15) 22%, rgba(21,22,23,0.1) 55%, rgba(21,22,23,0.8) 100%), linear-gradient(90deg, rgba(21,22,23,0.65) 0%, rgba(21,22,23,0) 60%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-white/15 px-6 py-3 md:px-12">
        <Wordmark />
        <button type="button" onClick={launch} className={OUTLINE_BUTTON}>
          Execute Concordemoon
        </button>
      </header>

      <main className="relative z-10 flex h-[calc(100%-3.75rem)] min-h-[32rem] flex-col justify-center px-6 md:px-12">
        <h1 className="rise max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-7xl" style={{ animationDelay: '150ms' }}>
          Stand on any horizon of the Moon
        </h1>
        <p className="rise mt-5 max-w-xl text-base text-[#d6dadc] md:text-lg" style={{ animationDelay: '280ms' }}>
          Know when the Sun powers your lander and when Earth can hear you, behind real NASA terrain.
        </p>
        <div className="rise mt-8" style={{ animationDelay: '400ms' }}>
          <button type="button" onClick={launch} className={OUTLINE_BUTTON}>
            Execute Concordemoon
          </button>
        </div>
      </main>

      <span aria-hidden className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-bounce text-xl text-white/70">
        ⌄
      </span>
      <p className="absolute bottom-5 right-6 z-10 max-w-xs text-right text-[11px] leading-snug text-[#c0c0c0] md:right-12">
        Footage:{' '}
        <a href={FOOTAGE_URL} target="_blank" rel="noreferrer" className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
          Tour of the Moon 4K
        </a>
        , NASA
      </p>
    </div>
  )
}
