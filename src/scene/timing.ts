import type { NextTransition } from './windows'

// Timing metrics for the sidebar, built in SiteView.
export type TimingMetrics = {
  sunNext: NextTransition
  earthNext: NextTransition
  sunPercent: number
  earthPercent: number
  periodStartMs: number
  periodEndMs: number
}
