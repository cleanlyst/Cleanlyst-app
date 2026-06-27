<template>
  <section class="monitoring-section" aria-labelledby="monitoring-heading">
    <div class="monitoring-header">
      <h1 id="monitoring-heading" class="section-title">System Monitoring</h1>
      <button class="btn btn--secondary btn--sm" :disabled="loading" @click="refresh">
        <span
          v-if="loading"
          class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        ></span>
        <span v-else class="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
        Refresh
      </button>
    </div>

    <p v-if="loadError" class="error-msg" role="alert">{{ loadError }}</p>

    <!-- Health status -->
    <div class="monitoring-grid">
      <div class="monitoring-card">
        <h2 class="monitoring-card__title">
          <span class="material-symbols-outlined" aria-hidden="true">health_and_safety</span>
          Health Check
        </h2>
        <div v-if="health" class="health-grid">
          <div
            v-for="(result, name) in health.subsystems"
            :key="name"
            class="health-item"
            :class="{ 'health-item--ok': result.ok, 'health-item--fail': !result.ok }"
          >
            <span
              class="material-symbols-outlined health-item__icon"
              :aria-label="result.ok ? 'OK' : 'Degraded'"
            >
              {{ result.ok ? 'check_circle' : 'error' }}
            </span>
            <div class="health-item__body">
              <span class="health-item__name">{{ subsystemLabel(name) }}</span>
              <span v-if="result.latency_ms != null" class="health-item__meta">
                {{ result.latency_ms }}ms
              </span>
              <span v-if="result.detail" class="health-item__detail">{{ result.detail }}</span>
              <span v-if="name === 'cron' && result.last_ran" class="health-item__meta">
                Last ran {{ timeAgo(result.last_ran) }}
                <template v-if="result.rows_affected != null">
                  · {{ result.rows_affected }} row{{ result.rows_affected === 1 ? '' : 's' }}
                </template>
              </span>
            </div>
          </div>
        </div>
        <p v-else-if="!loading" class="monitoring-empty">Health data unavailable.</p>
        <div v-else class="health-grid">
          <div v-for="n in 4" :key="n" class="health-item health-item--skeleton"></div>
        </div>
      </div>

      <!-- Cron summary -->
      <div class="monitoring-card">
        <h2 class="monitoring-card__title">
          <span class="material-symbols-outlined" aria-hidden="true">schedule</span>
          Cron Executions
        </h2>
        <div v-if="cronLog.length > 0" class="cron-table-wrap">
          <table class="monitoring-table" aria-label="Recent cron executions">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in cronLog"
                :key="row.id"
                :class="{ 'cron-row--error': row.status === 'error' }"
              >
                <td>{{ row.job_name }}</td>
                <td>
                  <span class="cron-badge" :class="`cron-badge--${row.status}`">
                    {{ row.status }}
                  </span>
                </td>
                <td>{{ row.rows_affected ?? '—' }}</td>
                <td>{{ row.duration_ms != null ? `${row.duration_ms}ms` : '—' }}</td>
                <td>{{ formatDateTime(row.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!loading" class="monitoring-empty">No cron executions recorded yet.</p>
        <p v-else class="monitoring-empty">Loading…</p>
      </div>

      <!-- Recent errors -->
      <div class="monitoring-card monitoring-card--full">
        <h2 class="monitoring-card__title">
          <span class="material-symbols-outlined" aria-hidden="true">report</span>
          Recent Errors
          <span v-if="errorCount > 0" class="monitoring-badge">{{ errorCount }}</span>
        </h2>
        <div v-if="recentErrors.length > 0" class="error-table-wrap">
          <table class="monitoring-table" aria-label="Recent system errors">
            <thead>
              <tr>
                <th>Level</th>
                <th>Component</th>
                <th>Message</th>
                <th>User</th>
                <th>Booking</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recentErrors" :key="row.id" class="error-row">
                <td>
                  <span class="error-level-badge" :class="`error-level-badge--${row.level}`">
                    {{ row.level }}
                  </span>
                </td>
                <td class="mono">{{ row.component }}</td>
                <td class="error-msg-cell" :title="row.error_message ?? row.message">
                  {{ truncate(row.error_message ?? row.message, 80) }}
                </td>
                <td class="mono">{{ row.user_id ? row.user_id.slice(0, 8) + '…' : '—' }}</td>
                <td class="mono">{{ row.booking_id ? row.booking_id.slice(0, 8) + '…' : '—' }}</td>
                <td>{{ formatDateTime(row.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!loading" class="monitoring-empty">No errors in the last 24 hours.</p>
        <p v-else class="monitoring-empty">Loading…</p>
      </div>

      <!-- Analytics summary -->
      <div class="monitoring-card monitoring-card--full">
        <h2 class="monitoring-card__title">
          <span class="material-symbols-outlined" aria-hidden="true">bar_chart</span>
          Event Analytics (Last 7 Days)
        </h2>
        <div v-if="analyticsRows.length > 0" class="analytics-grid">
          <div v-for="row in analyticsRows" :key="row.event" class="analytics-stat">
            <span class="analytics-stat__count">{{ row.count }}</span>
            <span class="analytics-stat__label">{{ eventLabel(row.event) }}</span>
          </div>
        </div>
        <p v-else-if="!loading" class="monitoring-empty">No events in the last 7 days.</p>
        <p v-else class="monitoring-empty">Loading…</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'
import { getSupabaseConfig } from '@/config/supabase'
import { toUserMessage } from '@/utils/format'
import { formatDateTime } from '@/utils/format'

interface SubsystemResult {
  ok: boolean
  latency_ms?: number
  detail?: string
  last_ran?: string
  rows_affected?: number
}

interface HealthData {
  status: 'ok' | 'degraded'
  generated_at: string
  subsystems: Record<string, SubsystemResult>
}

interface CronRow {
  id: string
  created_at: string
  job_name: string
  status: string
  rows_affected: number | null
  duration_ms: number | null
  error_detail: string | null
}

interface ErrorRow {
  id: string
  created_at: string
  level: string
  component: string
  message: string
  error_message: string | null
  user_id: string | null
  booking_id: string | null
}

interface AnalyticsRow {
  event: string
  count: number
}

const loading = ref(false)
const loadError = ref<string | null>(null)
const health = ref<HealthData | null>(null)
const cronLog = ref<CronRow[]>([])
const recentErrors = ref<ErrorRow[]>([])
const analyticsRows = ref<AnalyticsRow[]>([])

const errorCount = computed(() =>
  recentErrors.value.filter((e) => e.level === 'error' || e.level === 'critical').length,
)

function subsystemLabel(name: string): string {
  const labels: Record<string, string> = {
    database: 'Database',
    auth: 'Auth',
    realtime: 'Realtime',
    stripe: 'Stripe',
    cron: 'Cron',
    recent_errors: 'Recent Errors',
  }
  return labels[name] ?? name
}

function eventLabel(event: string): string {
  return event
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

async function fetchHealth(token: string): Promise<void> {
  const { url } = getSupabaseConfig()
  const res = await fetch(`${url}/functions/v1/health`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Health check returned HTTP ${res.status}`)
  health.value = (await res.json()) as HealthData
}

async function fetchCronLog(): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cron_execution_log')
    .select('id, created_at, job_name, status, rows_affected, duration_ms, error_detail')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  cronLog.value = (data ?? []) as CronRow[]
}

async function fetchRecentErrors(): Promise<void> {
  const supabase = getSupabaseClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('error_events')
    .select('id, created_at, level, component, message, error_message, user_id, booking_id')
    .in('level', ['warn', 'error', 'critical'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  recentErrors.value = (data ?? []) as ErrorRow[]
}

async function fetchAnalytics(): Promise<void> {
  const supabase = getSupabaseClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('analytics_events')
    .select('event')
    .gte('created_at', since)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.event] = (counts[row.event] ?? 0) + 1
  }
  analyticsRows.value = Object.entries(counts)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count)
}

async function refresh() {
  loading.value = true
  loadError.value = null

  try {
    const supabase = getSupabaseClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    await Promise.all([
      fetchHealth(token),
      fetchCronLog(),
      fetchRecentErrors(),
      fetchAnalytics(),
    ])
  } catch (e) {
    loadError.value = toUserMessage(e, 'Failed to load monitoring data. Please try again.')
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.monitoring-section {
  padding: 1.5rem;
  max-width: 1200px;
}

.monitoring-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.monitoring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 1.25rem;
}

.monitoring-card {
  background: var(--surface-card, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.monitoring-card--full {
  grid-column: 1 / -1;
}

.monitoring-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #111);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.monitoring-badge {
  background: var(--color-error, #ef4444);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 9999px;
  padding: 0 0.45rem;
  line-height: 1.4;
}

.monitoring-empty {
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

/* ── Health grid ─────────────────────────────────────────────────────────── */

.health-grid {
  display: grid;
  gap: 0.625rem;
}

.health-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--surface-subtle, #f9fafb);
}

.health-item--ok { border-left: 3px solid var(--color-success, #22c55e); }
.health-item--fail { border-left: 3px solid var(--color-error, #ef4444); }
.health-item--skeleton {
  height: 3rem;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.health-item__icon {
  font-size: 1.125rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.health-item--ok .health-item__icon { color: var(--color-success, #22c55e); }
.health-item--fail .health-item__icon { color: var(--color-error, #ef4444); }

.health-item__body {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.health-item__name {
  font-weight: 500;
  font-size: 0.875rem;
}

.health-item__meta {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.health-item__detail {
  font-size: 0.75rem;
  color: var(--color-error, #ef4444);
  word-break: break-word;
}

/* ── Tables ──────────────────────────────────────────────────────────────── */

.cron-table-wrap,
.error-table-wrap {
  overflow-x: auto;
}

.monitoring-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.monitoring-table th {
  text-align: left;
  padding: 0.375rem 0.625rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  border-bottom: 1px solid var(--border-subtle, #e5e7eb);
  white-space: nowrap;
}

.monitoring-table td {
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--border-subtle, #e5e7eb);
  vertical-align: top;
  color: var(--text-primary, #111);
}

.monitoring-table tbody tr:last-child td {
  border-bottom: none;
}

.cron-row--error td {
  background: #fef2f2;
}

.cron-badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.cron-badge--success { background: #dcfce7; color: #166534; }
.cron-badge--error   { background: #fee2e2; color: #991b1b; }

.error-level-badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.error-level-badge--warn     { background: #fef9c3; color: #854d0e; }
.error-level-badge--error    { background: #fee2e2; color: #991b1b; }
.error-level-badge--critical { background: #fce7f3; color: #9d174d; }

.error-msg-cell {
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

/* ── Analytics grid ──────────────────────────────────────────────────────── */

.analytics-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.analytics-stat {
  background: var(--surface-subtle, #f9fafb);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 120px;
}

.analytics-stat__count {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #111);
  line-height: 1;
}

.analytics-stat__label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

@media (max-width: 600px) {
  .monitoring-grid {
    grid-template-columns: 1fr;
  }
}
</style>
