// Round schedule math for the holders-airdrop fee mode. Trench heritage:
// holder range, N rounds, % of the vault per round, cap progression
// (multiply xN or step +$X). Adapted to fees: percentages apply to the
// vault balance at trigger time, since fees accrue continuously.
import { DROP_DEFAULTS, LIMITS } from './config.js'

export function normalizeDropConfig (raw = {}) {
  const d = { ...DROP_DEFAULTS, ...raw }
  const cfg = {
    holderFrom: clampInt(d.holderFrom, 1, LIMITS.holderMax),
    holderTo: clampInt(d.holderTo, 1, LIMITS.holderMax),
    rounds: clampInt(d.rounds, 1, LIMITS.roundsMax),
    pctPerRound: clampInt(d.pctPerRound, 1, 100),
    capMode: d.capMode === 'step' ? 'step' : 'multiply',
    capFactor: clampNum(d.capFactor, 1.1, 100),
    capStepUsd: clampNum(d.capStepUsd ?? d.capStep, 0, 1e9),
    startCapUsd: clampNum(d.startCapUsd ?? d.targetCap, 0, 1e12),
    trigger: d.trigger === 'interval' ? 'interval' : 'mcap',
    intervalHours: clampNum(d.intervalHours, 1, 24 * 30),
  }
  if (cfg.holderTo < cfg.holderFrom) [cfg.holderFrom, cfg.holderTo] = [cfg.holderTo, cfg.holderFrom]
  if (cfg.capMode === 'step' && cfg.capStepUsd <= 0) cfg.capMode = 'multiply'
  return cfg
}

// Returns [{ round, capUsd|afterHours, pct }]. pct = share of the vault
// balance distributed when the round triggers. After the last configured
// round the vault keeps flushing 100% at the same cadence (documented).
export function computeSchedule (cfg) {
  const rows = []
  for (let i = 0; i < cfg.rounds; i++) {
    const row = { round: i + 1, pct: cfg.pctPerRound }
    if (cfg.trigger === 'interval') {
      row.afterHours = cfg.intervalHours * (i + 1)
    } else {
      row.capUsd = cfg.capMode === 'multiply'
        ? cfg.startCapUsd * Math.pow(cfg.capFactor, i)
        : cfg.startCapUsd + cfg.capStepUsd * i
    }
    rows.push(row)
  }
  return rows
}

export function nextRound (cfg, roundsDone) {
  const schedule = computeSchedule(cfg)
  if (roundsDone < schedule.length) return schedule[roundsDone]
  // Past the configured schedule: keep flushing 100% at the same cadence.
  const extra = roundsDone - schedule.length + 1
  const row = { round: roundsDone + 1, pct: 100 }
  if (cfg.trigger === 'interval') {
    row.afterHours = cfg.intervalHours * (roundsDone + 1)
  } else {
    const lastCap = schedule.length ? schedule[schedule.length - 1].capUsd : cfg.startCapUsd
    row.capUsd = cfg.capMode === 'multiply'
      ? lastCap * Math.pow(cfg.capFactor, extra)
      : lastCap + cfg.capStepUsd * extra
  }
  return row
}

function clampInt (v, min, max) { return Math.min(max, Math.max(min, Math.round(Number(v) || min))) }
function clampNum (v, min, max) { return Math.min(max, Math.max(min, Number(v) || min)) }

export function validateSplitConfig (raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return { error: 'split needs 1 to 20 recipients' }
  const seen = new Set()
  let total = 0
  const out = []
  for (const r of raw) {
    const address = String(r.address || '').trim()
    const pct = Math.round(Number(r.pct))
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { error: `bad address: ${address || '(empty)'}` }
    if (seen.has(address.toLowerCase())) return { error: `duplicate address: ${address}` }
    if (!(pct >= 1 && pct <= 100)) return { error: 'each share must be 1 to 100 percent' }
    seen.add(address.toLowerCase())
    total += pct
    out.push({ address, pct })
  }
  if (total !== 100) return { error: `shares must add up to 100, got ${total}` }
  return { config: out }
}
