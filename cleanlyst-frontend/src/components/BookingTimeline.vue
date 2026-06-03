<template>
  <section class="timeline-section">
    <h2 class="timeline-heading">Booking Timeline</h2>

    <p v-if="loading" class="timeline-empty">Loading timeline…</p>
    <p v-else-if="error" class="timeline-error">{{ error }}</p>
    <p v-else-if="events.length === 0" class="timeline-empty">No events yet.</p>

    <ol v-else class="timeline-list">
      <li
        v-for="(event, index) in events"
        :key="event.id"
        :class="['timeline-item', index === 0 ? 'timeline-item--latest' : '']"
      >
        <div class="timeline-connector">
          <div class="timeline-dot"></div>
          <div v-if="index < events.length - 1" class="timeline-line"></div>
        </div>

        <div class="timeline-content">
          <div class="timeline-row">
            <span class="timeline-label">{{ eventLabel(event) }}</span>
            <time class="timeline-time">{{ formatDateTime(event.created_at) }}</time>
          </div>
          <p v-if="event.notes" class="timeline-notes">{{ event.notes }}</p>
          <p class="timeline-actor">
            {{ actorLabel(event) }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'
import { formatDateTime } from '@/utils/format'
import { getBookingStatusLabel } from '@/utils/bookingStatusLabel'

interface TimelineEvent {
  id: string
  booking_id: string
  from_status: string | null
  to_status: string
  actor_id: string | null
  actor_role: string | null
  notes: string | null
  created_at: string
  actor_name: string | null
}

const props = defineProps<{ bookingId: string }>()

const events = ref<TimelineEvent[]>([])
const loading = ref(true)
const error = ref('')

function eventLabel(event: TimelineEvent): string {
  const toLabel = getBookingStatusLabel({ status: event.to_status }, 'admin')
  if (!event.from_status) return toLabel

  const fromLabel = getBookingStatusLabel({ status: event.from_status }, 'admin')
  return `${fromLabel} → ${toLabel}`
}

function actorLabel(event: TimelineEvent): string {
  const name = event.actor_name ?? 'Unknown'
  const role = event.actor_role ?? ''
  if (!role) return name
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1)
  return `${roleDisplay}${event.actor_name ? ` — ${event.actor_name}` : ''}`
}

async function loadEvents() {
  loading.value = true
  error.value = ''
  try {
    const supabase = getSupabaseClient()
    const { data, error: err } = await supabase
      .from('booking_status_events')
      .select('id, booking_id, from_status, to_status, actor_id, actor_role, notes, created_at, actor:profiles!actor_id(full_name)')
      .eq('booking_id', props.bookingId)
      .order('created_at', { ascending: true })

    if (err) throw err

    events.value = ((data ?? []) as unknown[]).map((raw): TimelineEvent => {
      const row = raw as Record<string, unknown>
      const actorRaw = row.actor
      const actor = (Array.isArray(actorRaw) ? actorRaw[0] : actorRaw) as Record<string, unknown> | null
      return {
        id: String(row.id ?? ''),
        booking_id: String(row.booking_id ?? ''),
        from_status: row.from_status ? String(row.from_status) : null,
        to_status: String(row.to_status ?? ''),
        actor_id: row.actor_id ? String(row.actor_id) : null,
        actor_role: row.actor_role ? String(row.actor_role) : null,
        notes: row.notes ? String(row.notes) : null,
        created_at: String(row.created_at ?? ''),
        actor_name: actor?.full_name ? String(actor.full_name) : null,
      }
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load timeline.'
  } finally {
    loading.value = false
  }
}

onMounted(loadEvents)
watch(() => props.bookingId, loadEvents)

defineExpose({ reload: loadEvents })
</script>

<style scoped>
.timeline-section {
  background: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 1.5rem;
  margin-top: 1.5rem;
}

.timeline-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: var(--primary, #000000);
}

.timeline-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.timeline-item {
  display: grid;
  grid-template-columns: 1.25rem 1fr;
  gap: 0 0.875rem;
}

.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--outline-variant, #c4c7c7);
  flex-shrink: 0;
  margin-top: 3px;
}

.timeline-item--latest .timeline-dot {
  background: var(--primary, #000000);
}

.timeline-line {
  width: 1px;
  flex: 1;
  background: var(--outline-variant, #c4c7c7);
  margin: 4px 0;
  min-height: 1rem;
}

.timeline-content {
  padding-bottom: 1.25rem;
}

.timeline-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.timeline-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary, #000000);
  line-height: 1.4;
}

.timeline-time {
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
  white-space: nowrap;
  flex-shrink: 0;
}

.timeline-actor {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.timeline-notes {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0.25rem 0 0.125rem;
  font-style: italic;
}

.timeline-empty,
.timeline-error {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.timeline-error {
  color: #ba1a1a;
}
</style>
