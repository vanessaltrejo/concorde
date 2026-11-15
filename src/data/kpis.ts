// Impact KPIs for the Dashboard. These are NOT defined yet: the "before" numbers
// come from the team's research on how site evaluation is done today. Do not
// invent values. When a KPI is defined, fill `value` and set status to 'live'.

export type ImpactKpi = {
  id: string
  label: string
  unit: string
  hint: string
  status: 'pending' | 'live'
  value?: string
}

export const IMPACT_KPIS: ImpactKpi[] = [
  { id: 'hours-saved', label: 'Planning hours saved', unit: 'h per site review', hint: 'Today\'s process vs this tool (needs the team\'s research).', status: 'pending' },
  { id: 'cost-saved', label: 'Cost saved', unit: 'USD per review', hint: 'Analyst time and tool licences avoided.', status: 'pending' },
  { id: 'scenarios', label: 'Scenarios compared per session', unit: 'scenarios', hint: 'How many site-date options a planner checks.', status: 'pending' },
  { id: 'time-to-answer', label: 'Time to answer "does this site-date work?"', unit: 'min', hint: 'Baseline from Quickmap / Horizons workflow.', status: 'pending' },
]
