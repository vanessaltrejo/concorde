# AI assistant: build plan and status

Written 2026-11-14 from `ai_assistant_context.md` (team context doc). Nothing is
committed. Every decision that differs from the context doc is marked **Changed**.

## What changed since the context doc

- **The criteria panel is committed** (`RequirementsPanel`, `scene/requirements.ts`,
  `site_slopes.json`). So `setCriteria` (doc section 5) is no longer blocked, and
  Phase 4 is partly possible: the assistant can turn requirements on and set
  their thresholds. It does not invent thresholds; it only sets values the user
  asks for, or the verified defaults.
- **Six sites have data**, not only Shackleton. Tools take a `siteId`.

## Architecture as built

| Part | File | Note |
|---|---|---|
| Serverless endpoint | `api/chat.ts` | Vercel function (`POST /api/chat`). Holds the key. |
| Provider adapter | `api/_lib/provider.ts` | **Changed:** no Vercel AI SDK. Gemini, Groq and OpenRouter all have OpenAI-compatible chat endpoints, so one `fetch` client covers all three. Swap with `AI_PROVIDER=gemini|groq|openrouter`. No new npm packages (no download needed). |
| System prompt | `api/_lib/prompt.ts` | App guide, rules, disclosure pattern, verified thresholds. |
| Number check | `api/_lib/verify.ts` | Strict (AI-13). Tests: `node api/_lib/verify.test.ts`. |
| Rate limit | `api/_lib/rateLimit.ts` | Per visitor (IP), in memory. See limits below. |
| Local dev | `vite.config.ts` plugin | `npm run dev` serves `/api/chat` with the same handler. No Vercel CLI needed. |
| Tools (browser) | `src/assistant/tools.ts` | Read and write tools run in the browser, on the app's own data and state. |
| Thresholds | `src/assistant/thresholds.ts` | Context doc section 7, with status and citation text. |
| Chat loop | `src/assistant/client.ts` | Sends messages, runs tool calls, sends results back. |
| UI | `src/assistant/AssistantPanel.tsx` | Side panel over both views, source chips, mic, action banner. |

**Why tools run in the browser:** the app state (view, date, layer, criteria)
and the loaded data live in the browser. The server only talks to the model and
checks the final answer. The client sends tool results back with each request.

**Changed: no token streaming.** Strict verification (AI-13) needs the whole
answer before it is shown; streaming would show numbers that may then be
dropped. The panel shows "Thinking…" / "Reading app data…" while it works. If
the team prefers streaming, switch AI-13 to "warn" mode (flag, not drop).

**Source chips** are per answer (the sources of every tool used in that turn),
not per sentence.

## Phases

| Phase | Status |
|---|---|
| 0. Setup: key, Fluid Compute, slope gate, demo site | **Needs people.** Emiliano: create the key and put it in `.env.local` (local) and Vercel env vars. Confirm Fluid Compute. |
| 1. Chat endpoint | Built. Not tested against a live model (no key yet). |
| 2. Read tools + number check + source chips | Built. Tools checked in the browser; check tested with `verify.test.ts`. |
| 3. Action tools + banner | Built. Checked in the browser. |
| 4. Autocomplete requirements | Partly built: `setRequirements`. Site comparison works through `evaluateRequirements`. |
| 5. Voice | Built (Web Speech API input). Voice output not built (not verified). |
| 6. Guardrails + test set | Built: disclosure pattern, 429 / quota message, rate limit, eval set in `docs/AI_ASSISTANT_EVAL.md`. Eval not run (needs the key). |
| 7. Site history cards | Not started (out of scope). |

## Environment variables (server only, never `VITE_`)

```
AI_PROVIDER=gemini            # gemini | groq | openrouter
GEMINI_API_KEY=...            # or GROQ_API_KEY / OPENROUTER_API_KEY
AI_MODEL=                     # optional; default per provider (see provider.ts)
AI_RATE_LIMIT_PER_HOUR=30     # optional, per visitor
```

## Known limits

- The rate limit is per server instance (memory). On Vercel, instances restart
  and scale, so it is a soft limit. A durable limit needs a store (e.g. Upstash
  Redis), which is an account and a new dependency: team decision.
- Default model names (`gemini-2.5-flash-lite`, `openai/gpt-oss-120b`) are
  **not verified** for this account; set `AI_MODEL` after checking the console.
- Free-tier Gemini prompts may be used by Google to improve products; the panel
  says so.
