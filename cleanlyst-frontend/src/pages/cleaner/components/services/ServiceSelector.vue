<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DURATION_OPTIONS,
  SERVICE_CATALOG,
  type ServiceCategory,
  type SubService,
} from '@/utils/serviceCatalog'
import type { ServiceDraft } from '@/stores/cleanerServices'

interface Props {
  existingTitles: Set<string>
  saving: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  submit: [drafts: ServiceDraft[]]
  cancel: []
}>()

// ── Selection state ───────────────────────────────────────────────────────────
const selectedCategorySlugs = ref(new Set<string>())

interface PricingEntry {
  price: string
  duration: string
}

const checkedSubs = ref(new Set<string>())
// Use a plain reactive record so v-model on nested props works correctly
const pricing = ref<Record<string, PricingEntry>>({})
const fieldErrors = ref<Record<string, string>>({})

const selectedCategories = computed<ServiceCategory[]>(() =>
  SERVICE_CATALOG.filter((c) => selectedCategorySlugs.value.has(c.slug)),
)

// ── Selection helpers ─────────────────────────────────────────────────────────
function subKey(category: ServiceCategory, sub: SubService): string {
  return `${category.slug}::${sub.slug}`
}

function isAlreadyAdded(sub: SubService): boolean {
  return props.existingTitles.has(sub.name)
}

function toggleCategory(slug: string) {
  if (selectedCategorySlugs.value.has(slug)) {
    selectedCategorySlugs.value.delete(slug)
    const cat = SERVICE_CATALOG.find((c) => c.slug === slug)
    if (cat) {
      for (const sub of cat.subServices) {
        const key = `${slug}::${sub.slug}`
        checkedSubs.value.delete(key)
        delete pricing.value[key]
        delete fieldErrors.value[key]
      }
    }
  } else {
    selectedCategorySlugs.value.add(slug)
  }
}

function toggleSub(category: ServiceCategory, sub: SubService) {
  if (isAlreadyAdded(sub)) return
  const key = subKey(category, sub)
  if (checkedSubs.value.has(key)) {
    checkedSubs.value.delete(key)
    delete pricing.value[key]
    delete fieldErrors.value[key]
  } else {
    checkedSubs.value.add(key)
    pricing.value[key] = { price: '', duration: String(DURATION_OPTIONS[2].minutes) } // default 1h
  }
}

// ── Computed summary ──────────────────────────────────────────────────────────
const selectedCount = computed(() => checkedSubs.value.size)

// ── Validation & submit ───────────────────────────────────────────────────────
function validate(): boolean {
  fieldErrors.value = {}
  let valid = true
  for (const key of checkedSubs.value) {
    const entry = pricing.value[key]
    if (!entry) continue
    const price = parseFloat(entry.price)
    if (!entry.price.trim() || isNaN(price) || price <= 0) {
      fieldErrors.value[key] = 'Enter a valid price greater than £0'
      valid = false
    } else if (!entry.duration) {
      fieldErrors.value[key] = 'Select a duration'
      valid = false
    }
  }
  return valid
}

function buildDrafts(): ServiceDraft[] {
  const drafts: ServiceDraft[] = []
  for (const cat of selectedCategories.value) {
    for (const sub of cat.subServices) {
      const key = subKey(cat, sub)
      if (!checkedSubs.value.has(key)) continue
      const entry = pricing.value[key]
      if (!entry) continue
      drafts.push({
        title: sub.name,
        category: cat.name,
        base_price_cents: Math.round(parseFloat(entry.price) * 100),
        duration_minutes: parseInt(entry.duration, 10),
      })
    }
  }
  return drafts
}

function handleSubmit() {
  if (selectedCount.value === 0) return
  if (!validate()) return
  emit('submit', buildDrafts())
}
</script>

<template>
  <div class="selector-root">
    <!-- Header -->
    <div class="selector-header">
      <div>
        <h2 class="selector-title">Add Services</h2>
        <p class="selector-subtitle">
          Select the categories you work in, then choose specific services and set your pricing.
        </p>
      </div>
      <button class="btn-ghost" type="button" @click="emit('cancel')">
        <span class="material-symbols-outlined">close</span>
        Cancel
      </button>
    </div>

    <!-- Step 1: Category grid -->
    <section class="step-section">
      <h3 class="step-label">
        <span class="step-num">1</span>
        Select service categories
      </h3>
      <div class="category-grid">
        <button
          v-for="cat in SERVICE_CATALOG"
          :key="cat.slug"
          type="button"
          :class="['cat-card', { 'cat-card--selected': selectedCategorySlugs.value.has(cat.slug) }]"
          @click="toggleCategory(cat.slug)"
        >
          <span class="material-symbols-outlined cat-icon">{{ cat.icon }}</span>
          <span class="cat-name">{{ cat.name }}</span>
          <span
            v-if="selectedCategorySlugs.value.has(cat.slug)"
            class="material-symbols-outlined cat-check"
          >
            check_circle
          </span>
        </button>
      </div>
    </section>

    <!-- Step 2+3: Sub-services + pricing (only if categories selected) -->
    <section v-if="selectedCategories.length" class="step-section">
      <h3 class="step-label">
        <span class="step-num">2</span>
        Choose services &amp; set pricing
      </h3>

      <div class="sub-section-list">
        <div
          v-for="cat in selectedCategories"
          :key="cat.slug"
          class="sub-section"
        >
          <div class="sub-section-header">
            <span class="material-symbols-outlined sub-section-icon">{{ cat.icon }}</span>
            <span class="sub-section-name">{{ cat.name }}</span>
          </div>

          <div class="sub-rows">
            <div
              v-for="sub in cat.subServices"
              :key="sub.slug"
              :class="[
                'sub-row',
                {
                  'sub-row--checked': checkedSubs.value.has(subKey(cat, sub)),
                  'sub-row--disabled': isAlreadyAdded(sub),
                },
              ]"
            >
              <div class="sub-row-top">
                <!-- Checkbox -->
                <button
                  type="button"
                  :class="['sub-checkbox', { 'sub-checkbox--checked': checkedSubs.value.has(subKey(cat, sub)) }]"
                  :disabled="isAlreadyAdded(sub)"
                  @click="toggleSub(cat, sub)"
                  :aria-pressed="checkedSubs.value.has(subKey(cat, sub))"
                >
                  <span class="material-symbols-outlined checkbox-icon">
                    {{ checkedSubs.value.has(subKey(cat, sub)) ? 'check_box' : 'check_box_outline_blank' }}
                  </span>
                </button>

                <span class="sub-name">{{ sub.name }}</span>

                <span v-if="isAlreadyAdded(sub)" class="already-badge">Already added</span>
              </div>

              <!-- Inline pricing config (appears when sub is checked) -->
              <div
                v-if="checkedSubs.value.has(subKey(cat, sub)) && pricing.value[subKey(cat, sub)]"
                class="pricing-row"
              >
                <!-- Price input -->
                <div class="pricing-field">
                  <label class="pricing-label" :for="`price-${subKey(cat, sub)}`">Price</label>
                  <div class="price-wrap">
                    <span class="price-prefix">£</span>
                    <input
                      :id="`price-${subKey(cat, sub)}`"
                      v-model="pricing.value[subKey(cat, sub)].price"
                      class="pricing-input price-input"
                      :class="{ 'pricing-input--error': !!fieldErrors.value[subKey(cat, sub)] }"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <!-- Duration select -->
                <div class="pricing-field">
                  <label class="pricing-label" :for="`dur-${subKey(cat, sub)}`">Duration</label>
                  <select
                    :id="`dur-${subKey(cat, sub)}`"
                    v-model="pricing.value[subKey(cat, sub)].duration"
                    class="pricing-input pricing-select"
                  >
                    <option v-for="opt in DURATION_OPTIONS" :key="opt.minutes" :value="String(opt.minutes)">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <!-- Field error -->
                <p v-if="fieldErrors.value[subKey(cat, sub)]" class="pricing-error">
                  {{ fieldErrors.value[subKey(cat, sub)] }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer actions -->
    <div class="selector-footer">
      <button class="btn-action" type="button" @click="emit('cancel')">Cancel</button>
      <button
        class="btn-start"
        type="button"
        :disabled="selectedCount === 0 || saving"
        @click="handleSubmit"
      >
        <span v-if="saving" class="material-symbols-outlined btn-spinner">progress_activity</span>
        <span v-else class="material-symbols-outlined">add</span>
        {{ saving ? 'Saving…' : `Add ${selectedCount} Service${selectedCount !== 1 ? 's' : ''}` }}
      </button>
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

/* ── Selector root ────────────────────────────────────────────────────── */
.selector-root {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* ── Header ───────────────────────────────────────────────────────────── */
.selector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.selector-title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0 0 0.375rem;
  line-height: 1.3;
}

.selector-subtitle {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
  line-height: 1.6;
}

/* ── Step section ─────────────────────────────────────────────────────── */
.step-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.step-label {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--primary, #000000);
  margin: 0;
}

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Category grid ────────────────────────────────────────────────────── */
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .category-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .category-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.cat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: border-color 150ms, background-color 150ms;
  min-height: 5rem;
}

.cat-card:hover {
  border-color: var(--primary, #000000);
  background: var(--surface-variant, #f4f4f5);
}

.cat-card--selected {
  border-color: var(--primary, #000000);
  background: var(--surface-variant, #f4f4f5);
}

.cat-icon {
  font-size: 1.25rem;
  color: var(--primary, #000000);
}

.cat-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--primary, #000000);
}

.cat-check {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 1rem;
  color: var(--primary, #000000);
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* ── Sub-section list ─────────────────────────────────────────────────── */
.sub-section-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sub-section {
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.sub-section-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--surface-variant, #f4f4f5);
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.sub-section-icon {
  font-size: 1.125rem;
  color: var(--secondary, #5e5e5e);
}

.sub-section-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--primary, #000000);
  text-transform: uppercase;
}

/* ── Sub rows ─────────────────────────────────────────────────────────── */
.sub-rows {
  display: flex;
  flex-direction: column;
}

.sub-row {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--surface-variant, #e2e2e2);
  transition: background-color 150ms;
}

.sub-row:last-child {
  border-bottom: none;
}

.sub-row--checked {
  background: #fafafa;
}

.sub-row--disabled {
  opacity: 0.5;
}

.sub-row-top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

/* ── Checkbox button ──────────────────────────────────────────────────── */
.sub-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--outline-variant, #c4c7c7);
  transition: color 150ms;
  flex-shrink: 0;
}

.sub-checkbox:disabled {
  cursor: not-allowed;
}

.sub-checkbox--checked {
  color: var(--primary, #000000);
}

.sub-checkbox--checked .checkbox-icon {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.checkbox-icon {
  font-size: 1.25rem;
}

.sub-name {
  font-size: 14px;
  font-weight: 400;
  color: var(--primary, #000000);
  line-height: 1.5;
  flex: 1;
}

.already-badge {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  background: var(--surface-variant, #e2e2e2);
  padding: 0.125rem 0.5rem;
  flex-shrink: 0;
}

/* ── Pricing row ──────────────────────────────────────────────────────── */
.pricing-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-left: 1.875rem; /* align under sub-name, past checkbox */
}

.pricing-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pricing-label {
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

.pricing-input {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
  outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
}

.pricing-input:focus {
  border-color: var(--primary, #000000);
}

.pricing-input--error {
  border-color: #ba1a1a;
}

.price-input {
  width: 7rem;
  padding-left: 1.5rem;
}

.pricing-select {
  width: 9rem;
  cursor: pointer;
  appearance: auto;
}

.pricing-error {
  width: 100%;
  font-size: 12px;
  color: #ba1a1a;
  margin: 0.125rem 0 0;
}

/* ── Footer ───────────────────────────────────────────────────────────── */
.selector-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
}

/* ── Buttons (matching existing dashboard style) ──────────────────────── */
.btn-start {
  padding: 0.625rem 1.25rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
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

.btn-start .material-symbols-outlined {
  font-size: 1rem;
}

.btn-action {
  padding: 0.625rem 1rem;
  background-color: transparent;
  color: var(--primary, #000000);
  font-size: 14px;
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

.btn-ghost {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 14px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  transition: color 0.15s;
}

.btn-ghost:hover {
  color: var(--primary, #000000);
}

.btn-ghost .material-symbols-outlined {
  font-size: 1.125rem;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-spinner {
  animation: spin 1s linear infinite;
}
</style>
