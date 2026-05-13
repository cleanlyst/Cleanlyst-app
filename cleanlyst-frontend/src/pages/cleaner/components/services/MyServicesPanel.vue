<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { CleanerService } from '@/stores/cleanerServices'
import { DURATION_OPTIONS, formatDuration } from '@/utils/serviceCatalog'

interface Props {
  services: CleanerService[]
  mutating: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  update: [id: string, patch: { base_price_cents: number; duration_minutes: number }]
  remove: [id: string]
}>()

// ── Category grouping ─────────────────────────────────────────────────────────
interface ServiceGroup {
  category: string
  services: CleanerService[]
}

const groups = computed<ServiceGroup[]>(() => {
  const map = new Map<string, CleanerService[]>()
  for (const s of props.services) {
    if (!map.has(s.category)) map.set(s.category, [])
    map.get(s.category)!.push(s)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, services]) => ({ category, services }))
})

// ── Collapsed categories ──────────────────────────────────────────────────────
const collapsed = ref(new Set<string>())

function toggleCollapse(category: string) {
  if (collapsed.value.has(category)) {
    collapsed.value.delete(category)
  } else {
    collapsed.value.add(category)
  }
}

// ── Inline edit state ─────────────────────────────────────────────────────────
interface EditEntry {
  price: string
  duration: string
}

const editingId = ref<string | null>(null)
const editState = reactive<EditEntry>({ price: '', duration: '' })
const editError = ref<string | null>(null)
const removingId = ref<string | null>(null)

function startEdit(s: CleanerService) {
  editingId.value = s.id
  editState.price = (s.base_price_cents / 100).toFixed(2)
  editState.duration = String(s.duration_minutes)
  editError.value = null
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

async function saveEdit() {
  editError.value = null
  const price = parseFloat(editState.price)
  if (isNaN(price) || price <= 0) {
    editError.value = 'Enter a valid price greater than £0'
    return
  }
  if (!editState.duration) {
    editError.value = 'Select a duration'
    return
  }
  const id = editingId.value!
  editingId.value = null
  emit('update', id, {
    base_price_cents: Math.round(price * 100),
    duration_minutes: parseInt(editState.duration, 10),
  })
}

async function handleRemove(id: string) {
  removingId.value = id
  emit('remove', id)
}

function formatPrice(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`
}

// Duration matches closest option label or falls back to formatDuration
function durationLabel(minutes: number): string {
  return DURATION_OPTIONS.find((o) => o.minutes === minutes)?.label ?? formatDuration(minutes)
}
</script>

<template>
  <div class="panel-root">
    <div v-if="groups.length === 0" class="empty-state">
      <span class="material-symbols-outlined empty-icon">cleaning_services</span>
      <p class="empty-label">No services added yet</p>
      <p class="empty-desc">
        Add the services you offer so customers can find and book you.
      </p>
    </div>

    <div v-else class="groups-list">
      <div
        v-for="group in groups"
        :key="group.category"
        class="group"
      >
        <!-- Group header -->
        <button
          type="button"
          class="group-header"
          @click="toggleCollapse(group.category)"
        >
          <div class="group-header-left">
            <span class="group-name">{{ group.category }}</span>
            <span class="group-count">{{ group.services.length }}</span>
          </div>
          <span class="material-symbols-outlined collapse-icon">
            {{ collapsed.has(group.category) ? 'expand_more' : 'expand_less' }}
          </span>
        </button>

        <!-- Service rows -->
        <div v-if="!collapsed.has(group.category)" class="service-rows">
          <div
            v-for="s in group.services"
            :key="s.id"
            :class="['service-row', { 'service-row--editing': editingId === s.id }]"
          >
            <!-- View mode -->
            <template v-if="editingId !== s.id">
              <div class="row-view">
                <span class="row-title">{{ s.title }}</span>
                <div class="row-meta">
                  <span class="row-duration">
                    <span class="material-symbols-outlined meta-icon">schedule</span>
                    {{ durationLabel(s.duration_minutes) }}
                  </span>
                  <span class="row-price">{{ formatPrice(s.base_price_cents) }}</span>
                </div>
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="mutating"
                    :title="`Edit ${s.title}`"
                    @click="startEdit(s)"
                  >
                    <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--remove"
                    :disabled="mutating && removingId === s.id"
                    :title="`Remove ${s.title}`"
                    @click="handleRemove(s.id)"
                  >
                    <span
                      v-if="mutating && removingId === s.id"
                      class="material-symbols-outlined icon-spin"
                    >progress_activity</span>
                    <span v-else class="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <div class="row-edit">
                <span class="row-title row-title--editing">{{ s.title }}</span>
                <div class="edit-fields">
                  <div class="edit-field">
                    <label class="edit-label" :for="`ep-${s.id}`">Price</label>
                    <div class="price-wrap">
                      <span class="price-prefix">£</span>
                      <input
                        :id="`ep-${s.id}`"
                        v-model="editState.price"
                        class="edit-input price-input"
                        :class="{ 'edit-input--error': !!editError }"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div class="edit-field">
                    <label class="edit-label" :for="`ed-${s.id}`">Duration</label>
                    <select
                      :id="`ed-${s.id}`"
                      v-model="editState.duration"
                      class="edit-input edit-select"
                    >
                      <option
                        v-for="opt in DURATION_OPTIONS"
                        :key="opt.minutes"
                        :value="String(opt.minutes)"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                  <div class="edit-btns">
                    <button class="btn-action" type="button" @click="cancelEdit">Cancel</button>
                    <button class="btn-start" type="button" :disabled="mutating" @click="saveEdit">
                      Save
                    </button>
                  </div>
                </div>
                <p v-if="editError" class="edit-error">{{ editError }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────────────── */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

/* ── Panel root ───────────────────────────────────────────────────────── */
.panel-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Empty state ──────────────────────────────────────────────────────── */
.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.empty-icon {
  font-size: 3rem;
  color: var(--outline-variant, #c4c7c7);
  margin-bottom: 0.25rem;
}

.empty-label {
  font-size: 18px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0;
}

.empty-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Groups ───────────────────────────────────────────────────────────── */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group {
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  background: var(--surface-variant, #f4f4f5);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 150ms;
}

.group-header:hover {
  background: #ebebeb;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.group-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--primary, #000000);
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.collapse-icon {
  font-size: 1.25rem;
  color: var(--secondary, #5e5e5e);
}

/* ── Service rows ─────────────────────────────────────────────────────── */
.service-rows {
  display: flex;
  flex-direction: column;
}

.service-row {
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  padding: 0.875rem 1rem;
  transition: background-color 150ms;
}

.service-row:hover {
  background: #fafafa;
}

.service-row--editing {
  background: #fafafa;
}

/* ── View mode row ────────────────────────────────────────────────────── */
.row-view {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.row-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  min-width: 10rem;
}

.row-title--editing {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.row-duration {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}

.meta-icon {
  font-size: 0.9rem;
}

.row-price {
  font-size: 15px;
  font-weight: 700;
  color: var(--primary, #000000);
  letter-spacing: -0.01em;
  min-width: 4rem;
  text-align: right;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

/* ── Icon buttons ─────────────────────────────────────────────────────── */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  transition: color 150ms, border-color 150ms, background-color 150ms;
}

.icon-btn:hover:not(:disabled) {
  color: var(--primary, #000000);
  border-color: var(--outline-variant, #c4c7c7);
  background: var(--surface-variant, #f4f4f5);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn .material-symbols-outlined {
  font-size: 1rem;
}

.icon-btn--remove {
  color: #ba1a1a;
}

.icon-btn--remove:hover:not(:disabled) {
  color: #ba1a1a;
  border-color: #ba1a1a;
  background: #ffebee;
}

/* ── Edit mode ────────────────────────────────────────────────────────── */
.row-edit {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.edit-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.edit-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.price-wrap {
  position: relative;
}

.price-prefix {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  pointer-events: none;
}

.edit-input {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
  outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
}

.edit-input:focus {
  border-color: var(--primary, #000000);
}

.edit-input--error {
  border-color: #ba1a1a;
}

.price-input {
  width: 7rem;
  padding-left: 1.5rem;
}

.edit-select {
  width: 9rem;
  cursor: pointer;
  appearance: auto;
}

.edit-btns {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.edit-error {
  font-size: 12px;
  color: #ba1a1a;
  margin: 0.5rem 0 0;
}

/* ── Buttons ──────────────────────────────────────────────────────────── */
.btn-start {
  padding: 0.5rem 1rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: opacity 0.15s;
}

.btn-start:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-action {
  padding: 0.5rem 0.875rem;
  background-color: transparent;
  color: var(--primary, #000000);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: background-color 0.15s;
}

.btn-action:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.icon-spin {
  animation: spin 1s linear infinite;
}
</style>
