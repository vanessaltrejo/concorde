import { useState } from 'react'

type ProfileTabProps = {
  guest: boolean
  onJoinGuest: () => void
  onLeaveGuest: () => void
  onReplayTutorial: () => void
}

const cta =
  'flex w-full items-center justify-center gap-2 rounded bg-[#FFD400] px-3 py-2 text-sm font-semibold text-black hover:brightness-110'
const field =
  'w-full rounded border border-[#555] bg-[#262626] px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-gray-300'

// Profile page. Two versions: the login (only the look for now, nothing is
// sent anywhere) and the guest profile. "Join as guest" enters the app with a
// short tutorial.
export function ProfileTab({ guest, onJoinGuest, onLeaveGuest, onReplayTutorial }: ProfileTabProps) {
  const [notice, setNotice] = useState(false)

  return (
    <div className="relative flex h-full min-w-0 flex-1 items-start justify-center overflow-hidden bg-black p-4 md:items-center">
      <img
        src="/textures/moon-hero.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-16 w-[28rem] select-none opacity-60 [mask-image:radial-gradient(circle_at_40%_60%,black_45%,transparent_72%)]"
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-lg border border-[#444] bg-[#303030] p-5 text-gray-100 shadow-lg">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
          Profile
        </h1>

        {guest ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#262626] text-gray-300" aria-hidden>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium">Guest</p>
                <p className="text-xs text-gray-400">Everything works. Saved places stay in this browser.</p>
              </div>
            </div>
            <button type="button" onClick={onReplayTutorial} className={cta}>
              Replay tutorial
            </button>
            <button type="button" onClick={onLeaveGuest} className={cta}>
              Log in
            </button>
          </>
        ) : (
          <>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                setNotice(true)
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                Email
                <input type="email" autoComplete="email" placeholder="you@example.com" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Password
                <input type="password" autoComplete="current-password" placeholder="••••••••" className={field} />
              </label>
              <button type="submit" className={cta}>
                Log in
              </button>
              {notice && <p className="text-xs text-gray-400">Accounts are coming soon. Join as guest to try everything now.</p>}
            </form>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="h-px flex-1 bg-[#444]" />
              or
              <span className="h-px flex-1 bg-[#444]" />
            </div>
            <button type="button" onClick={onJoinGuest} className={cta}>
              Join as guest
            </button>
          </>
        )}
      </div>
    </div>
  )
}
