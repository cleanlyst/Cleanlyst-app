<template>
  <main class="page-main">
    <div class="page-header">
      <h1 class="page-title">Availability</h1>
      <p class="page-desc">
        Set the days and hours you are available to take bookings. Changes take effect immediately
        for new booking requests.
      </p>
    </div>
    <div class="form-grid">
      <div class="right-col">
        <section class="schedule-section">
          <div class="schedule-header">
            <div class="schedule-head-left">
              <span class="material-symbols-outlined section-icon">calendar_month</span>
              <h2 class="section-title">Weekly Schedule</h2>
            </div>
          </div>

          <div v-if="loadError" class="load-error" role="alert">
            <span class="material-symbols-outlined">error</span>
            {{ loadError }}
          </div>

          <div v-if="pageLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading schedule…</p>
          </div>

          <div v-else class="schedule-card">
            <div class="day-rows">
              <div
                v-for="day in schedule"
                :key="day.index"
                class="day-row"
                :class="{ 'day-row--off': !day.active }"
              >
                <div class="day-name-col">
                  <span class="day-name" :class="{ 'day-name--muted': !day.active }">
                    {{ day.label }}
                  </span>
                  <span class="day-status" :class="{ 'day-status--off': !day.active }">
                    {{ day.active ? 'Available' : 'Off' }}
                  </span>
                </div>
                <div class="time-inputs" :class="{ 'time-inputs--disabled': !day.active }">
                  <input
                    v-model="day.start"
                    class="time-input"
                    type="time"
                    :disabled="!day.active"
                    :aria-label="`${day.label} start time`"
                  />
                  <span class="time-sep">to</span>
                  <input
                    v-model="day.end"
                    class="time-input"
                    type="time"
                    :disabled="!day.active"
                    :aria-label="`${day.label} end time`"
                  />
                </div>
                <label class="day-toggle-wrap" :aria-label="`${day.label} availability`">
                  <input
                    v-model="day.active"
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    :aria-label="`${day.label} availability`"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
            </div>
          </div>

          <div v-if="saveError" class="save-error" role="alert">{{ saveError }}</div>
          <div v-if="saveSuccess" class="save-success">
            <span class="material-symbols-outlined">check_circle</span>
            Schedule saved successfully.
          </div>

          <div class="form-footer">
            <button class="btn-discard" :disabled="pageLoading || saving" @click="discardChanges">
              Discard Changes
            </button>
            <button
              class="btn-save"
              :disabled="pageLoading || saving"
              @click="saveSchedule"
              :aria-busy="saving"
            >
              {{ saving ? 'Saving schedule…' : 'Save weekly schedule' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getCleanerAvailability, upsertAvailabilitySlots } from '@/services/availabilityService'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// day_of_week uses PostgreSQL DOW: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// UI order is Mon–Sun, so the mapping is: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0] as const

type DayOfWeek = (typeof DAY_NUMBERS)[number]

interface DaySlot {
  index: number
  dayOfWeek: DayOfWeek
  label: string
  active: boolean
  start: string
  end: string
}

const DEFAULT_START = '09:00'
const DEFAULT_END = '17:00'

function buildDefaultSchedule(): DaySlot[] {
  return DAY_LABELS.map((label, i) => {
    const dayOfWeek = DAY_NUMBERS[i]
    if (dayOfWeek === undefined) {
      throw new Error(`Invalid day index ${i} when building default schedule.`)
    }

    return {
      index: i,
      dayOfWeek,
      label,
      active: i < 5, // Mon-Fri on by default
      start: DEFAULT_START,
      end: DEFAULT_END,
    }
  })
}

const auth = useAuthStore()
const pageLoading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const schedule = reactive<DaySlot[]>(buildDefaultSchedule())
// Snapshot of the last-saved/loaded state so Discard can revert
let savedSnapshot: DaySlot[] = buildDefaultSchedule()

function applySnapshot(snap: DaySlot[]) {
  if (snap.length !== schedule.length) {
    throw new Error('Saved schedule snapshot length does not match the current schedule.')
  }

  for (let i = 0; i < schedule.length; i++) {
    const scheduleDay = schedule[i]
    const snapshotDay = snap[i]
    if (!scheduleDay || !snapshotDay) {
      throw new Error(`Missing schedule data at index ${i}`)
    }

    scheduleDay.active = snapshotDay.active
    scheduleDay.start = snapshotDay.start
    scheduleDay.end = snapshotDay.end
  }
}

function takeSnapshot(): DaySlot[] {
  return schedule.map((d) => ({ ...d }))
}

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  if (!auth.userId) {
    pageLoading.value = false
    return
  }
  try {
    const slots = await getCleanerAvailability(auth.userId)
    // Map DB rows back onto schedule slots by dayOfWeek
    const byDay = new Map(slots.map((s) => [s.day_of_week, s]))
    for (const day of schedule) {
      const slot = byDay.get(day.dayOfWeek)
      if (slot) {
        day.active = slot.active
        day.start = slot.start_time.slice(0, 5) // "HH:MM:SS" → "HH:MM"
        day.end = slot.end_time.slice(0, 5)
      } else {
        // No DB row means this day is off
        day.active = false
      }
    }
    savedSnapshot = takeSnapshot()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load schedule.'
  } finally {
    pageLoading.value = false
  }
})

function validateSchedule(): string | null {
  for (const day of schedule) {
    if (!day.active) continue
    if (!day.start || !day.end) return `${day.label}: start and end times are required.`
    if (day.end <= day.start) return `${day.label}: end time must be after start time.`
  }
  return null
}

async function saveSchedule() {
  if (!auth.userId) return
  const validationError = validateSchedule()
  if (validationError) {
    saveError.value = validationError
    return
  }
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const rows = schedule.map((d) => ({
      day_of_week: d.dayOfWeek,
      start_time: d.start,
      end_time: d.end,
      active: d.active,
    }))
    await upsertAvailabilitySlots(auth.userId, rows)
    savedSnapshot = takeSnapshot()
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 2500)
  } catch (e) {
    if (e instanceof Error) {
      saveError.value = e.message
    } else if (e && typeof e === 'object' && 'message' in e) {
      saveError.value = String((e as { message: unknown }).message)
    } else {
      saveError.value = 'Failed to save schedule.'
    }
  } finally {
    saving.value = false
  }
}

function discardChanges() {
  applySnapshot(savedSnapshot)
  saveError.value = ''
  saveSuccess.value = false
}
</script>

<style scoped>
/* ── Material Symbols ── */
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

/* ── Layout ── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

.page-header {
  max-width: 56rem;
}

.page-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  font-family: var(--font-h1, Inter, sans-serif);
  margin-bottom: 1rem;
  color: var(--primary, #000000);
}

.page-desc {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  font-family: var(--font-body, Inter, sans-serif);
  color: var(--secondary, #5e5e5e);
  margin-bottom: 3rem;
  max-width: 42rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
}

@media (min-width: 1024px) {
  .form-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  .right-col {
    grid-column: span 10;
  }
}

/* ── Schedule Section ── */
.schedule-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.schedule-head-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-icon {
  color: #a1a1aa;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  font-family: var(--font-h2, Inter, sans-serif);
  color: var(--primary, #000000);
}

/* ── Loading ── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

/* ── Error / Success ── */
.load-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--error, #ba1a1a);
  color: var(--error, #ba1a1a);
  font-size: 14px;
}

.save-error {
  font-size: 13px;
  color: var(--error, #ba1a1a);
  padding: 0.5rem 0;
}

.save-success {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 13px;
  color: #2e7d32;
}

/* ── Schedule Card ── */
.schedule-card {
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  overflow: hidden;
}

/* ── Day Row ── */
.day-row {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #f4f4f5;
  transition: background-color 150ms;
}

.day-row:last-child {
  border-bottom: none;
}

.day-row:hover {
  background-color: rgba(250, 250, 250, 0.5);
}

@media (min-width: 640px) {
  .day-row {
    flex-direction: row;
    align-items: center;
  }
}

.day-row--off {
  background-color: rgba(250, 250, 250, 0.3);
}

.day-name-col {
  width: 6rem;
  flex-shrink: 0;
}

.day-name {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  font-family: var(--font-label-md, Inter, sans-serif);
  display: block;
  color: var(--primary, #000000);
}

.day-name--muted {
  color: #a1a1aa;
}

.day-status {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  text-transform: uppercase;
  color: #a1a1aa;
  letter-spacing: 0.05em;
}

.day-status--off {
  color: #d4d4d8;
}

/* ── Time Inputs ── */
.time-inputs {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.125rem;
  outline: none;
  font-size: 0.875rem;
  font-family: var(--font-body, Inter, sans-serif);
  transition: border-color 150ms;
}

.time-input:focus {
  border-color: var(--primary, #000000);
}

.time-sep {
  color: #d4d4d8;
  font-size: 0.875rem;
}

.time-inputs--disabled {
  opacity: 0.3;
  pointer-events: none;
}

/* ── Toggle ── */
.day-toggle-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.day-toggle {
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  background: #e4e4e7;
  border-radius: 9999px;
  transition: background-color 200ms;
}

.day-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.25rem;
  height: 1.25rem;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 200ms;
}

.day-toggle-wrap:has(input:checked) .day-toggle {
  background: var(--primary, #000000);
}

.day-toggle-wrap:has(input:checked) .day-toggle::after {
  transform: translateX(1.25rem);
}

/* ── Form Footer ── */
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 2rem;
}

.btn-discard {
  padding: 0.75rem 2rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  font-family: var(--font-label-md, Inter, sans-serif);
  color: var(--primary, #000000);
  cursor: pointer;
  border-radius: 0.125rem;
  transition: background-color 150ms;
}

.btn-discard:hover:not(:disabled) {
  background-color: #fafafa;
}

.btn-discard:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-save {
  padding: 0.75rem 2rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  border: none;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  font-family: var(--font-label-md, Inter, sans-serif);
  cursor: pointer;
  border-radius: 0.125rem;
  transition: opacity 150ms;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
