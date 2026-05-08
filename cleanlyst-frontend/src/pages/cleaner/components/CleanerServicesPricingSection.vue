<template>
  <main class="page-main">
    <section class="page-header">
      <div>
        <h1 class="header-title">Services &amp; Pricing</h1>
        <p class="header-copy">Manage the services you offer and set your pricing.</p>
      </div>
    </section>

    <!-- Hourly Rate Banner -->
    <div class="rate-card">
      <div class="rate-card-left">
        <span class="material-symbols-outlined rate-icon">payments</span>
        <div>
          <p class="rate-label">Current Hourly Rate</p>
          <p class="rate-value">{{ hourlyRateLabel }}</p>
        </div>
      </div>
      <router-link class="rate-link" :to="{ name: 'CleanerAvailability' }">
        Update rate
        <span class="material-symbols-outlined">arrow_forward</span>
      </router-link>
    </div>

    <!-- Services Section -->
    <section class="services-section">
      <div class="section-header">
        <h2 class="section-title">My Services</h2>
        <button
          v-if="!showAddForm"
          class="btn-add"
          type="button"
          @click="openAddForm"
        >
          <span class="material-symbols-outlined">add</span>
          Add Service
        </button>
      </div>

      <!-- Add Service Form -->
      <div v-if="showAddForm" class="service-form-card">
        <h3 class="form-card-title">New Service</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="new-name">Service Name</label>
            <input
              id="new-name"
              v-model="newForm.name"
              class="form-input"
              placeholder="e.g. Deep Clean"
              type="text"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-price">Price</label>
            <div class="price-wrap">
              <span class="price-prefix">£</span>
              <input
                id="new-price"
                v-model="newForm.price"
                class="form-input price-input"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-duration">Duration</label>
            <input
              id="new-duration"
              v-model="newForm.duration"
              class="form-input"
              placeholder="e.g. 2–3 hours"
              type="text"
            />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-description">Description</label>
          <textarea
            id="new-description"
            v-model="newForm.description"
            class="form-textarea"
            placeholder="Describe what this service includes…"
            rows="3"
          ></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-action" type="button" @click="cancelAdd">Cancel</button>
          <button
            class="btn-start"
            type="button"
            :disabled="!newForm.name.trim()"
            @click="addService"
          >
            Add Service
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!services.length && !showAddForm" class="empty-state">
        <span class="material-symbols-outlined empty-icon">cleaning_services</span>
        <p class="empty-label">No services added yet</p>
        <p class="empty-desc">Add the cleaning services you offer to help customers book you.</p>
        <button class="btn-start" type="button" @click="openAddForm">Add your first service</button>
      </div>

      <!-- Service Cards -->
      <div v-if="services.length" class="services-list">
        <article v-for="s in services" :key="s.id" class="service-card">
          <!-- View mode -->
          <template v-if="editingId !== s.id">
            <div class="service-card-body">
              <div class="service-card-top">
                <div>
                  <h3 class="service-name">{{ s.name }}</h3>
                  <p class="service-description">{{ s.description }}</p>
                </div>
                <div class="service-meta">
                  <div class="service-meta-item">
                    <span class="material-symbols-outlined">schedule</span>
                    {{ s.duration }}
                  </div>
                  <div class="service-price">£{{ s.price }}</div>
                </div>
              </div>
            </div>
            <div class="service-card-footer">
              <button class="btn-action" type="button" @click="startEdit(s)">
                <span class="material-symbols-outlined">edit</span>
                Edit
              </button>
              <button class="btn-remove" type="button" @click="removeService(s.id)">
                <span class="material-symbols-outlined">delete</span>
                Remove
              </button>
            </div>
          </template>

          <!-- Edit mode -->
          <template v-else>
            <h3 class="form-card-title">Edit Service</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Service Name</label>
                <input v-model="editForm.name" class="form-input" type="text" />
              </div>
              <div class="form-group">
                <label class="form-label">Price</label>
                <div class="price-wrap">
                  <span class="price-prefix">£</span>
                  <input
                    v-model="editForm.price"
                    class="form-input price-input"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Duration</label>
                <input v-model="editForm.duration" class="form-input" type="text" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea v-model="editForm.description" class="form-textarea" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn-action" type="button" @click="cancelEdit">Cancel</button>
              <button class="btn-start" type="button" @click="saveEdit(s.id)">Save Changes</button>
            </div>
          </template>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'

interface Service {
  id: string
  name: string
  description: string
  duration: string
  price: string
}

defineProps({
  hourlyRateLabel: { type: String, default: 'Not set yet' },
})

const services = ref<Service[]>([
  {
    id: '1',
    name: 'Regular Clean',
    description: 'Standard home cleaning covering all rooms, vacuuming, and surface wiping.',
    duration: '2–3 hours',
    price: '60',
  },
  {
    id: '2',
    name: 'Deep Clean',
    description: 'Thorough cleaning of all surfaces, kitchen appliances, and bathrooms.',
    duration: '4–5 hours',
    price: '120',
  },
  {
    id: '3',
    name: 'End of Tenancy',
    description: 'Full property clean to meet tenancy checkout requirements.',
    duration: '6–8 hours',
    price: '180',
  },
])

const showAddForm = ref(false)
const editingId = ref<string | null>(null)

const newForm = reactive({ name: '', description: '', duration: '', price: '' })
const editForm = reactive({ name: '', description: '', duration: '', price: '' })

function openAddForm() {
  editingId.value = null
  newForm.name = ''
  newForm.description = ''
  newForm.duration = ''
  newForm.price = ''
  showAddForm.value = true
}

function cancelAdd() {
  showAddForm.value = false
}

function addService() {
  if (!newForm.name.trim()) return
  services.value.push({
    id: String(Date.now()),
    name: newForm.name.trim(),
    description: newForm.description.trim(),
    duration: newForm.duration.trim(),
    price: newForm.price,
  })
  showAddForm.value = false
}

function startEdit(s: Service) {
  showAddForm.value = false
  editingId.value = s.id
  editForm.name = s.name
  editForm.description = s.description
  editForm.duration = s.duration
  editForm.price = s.price
}

function cancelEdit() {
  editingId.value = null
}

function saveEdit(id: string) {
  const idx = services.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  services.value[idx] = {
    id,
    name: editForm.name,
    description: editForm.description,
    duration: editForm.duration,
    price: editForm.price,
  }
  editingId.value = null
}

function removeService(id: string) {
  services.value = services.value.filter((s) => s.id !== id)
}
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────── */
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

/* ── Page shell ───────────────────────────────────────────────── */
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

/* ── Page header ──────────────────────────────────────────────── */
.page-header {
  margin-bottom: 3rem;
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-bottom: 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

/* ── Hourly rate card ─────────────────────────────────────────── */
.rate-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  margin-bottom: 3rem;
  flex-wrap: wrap;
}

.rate-card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.rate-icon {
  font-size: 2rem;
  color: var(--secondary, #5e5e5e);
}

.rate-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.25rem;
}

.rate-value {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0;
}

.rate-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary, #000000);
  text-decoration: none;
}

.rate-link:hover {
  text-decoration: underline;
}

/* ── Services section ─────────────────────────────────────────── */
.services-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

/* ── Empty state ──────────────────────────────────────────────── */
.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
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
  margin-bottom: 0.5rem;
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
  margin: 0 0 1rem;
}

/* ── Add/edit form card ───────────────────────────────────────── */
.service-form-card {
  padding: 1.5rem;
  border: 1px solid var(--primary, #000000);
  background-color: var(--surface-container-lowest, #ffffff);
}

.form-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0 0 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.form-input,
.form-textarea {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.125rem;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--primary, #000000);
  background: #ffffff;
  outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
  width: 100%;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary, #000000);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.price-wrap {
  position: relative;
}

.price-prefix {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  pointer-events: none;
}

.price-input {
  padding-left: 1.75rem;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* ── Service cards list ───────────────────────────────────────── */
.services-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.service-card {
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  transition: border-color 0.15s;
}

.service-card:hover {
  border-color: var(--primary, #000000);
}

.service-card-body {
  margin-bottom: 1rem;
}

.service-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.service-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.service-description {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.service-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.service-meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
}

.service-meta-item .material-symbols-outlined {
  font-size: 1rem;
}

.service-price {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary, #000000);
  letter-spacing: -0.01em;
}

.service-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
}

/* ── Buttons ──────────────────────────────────────────────────── */
.btn-start {
  padding: 0.5rem 1.25rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: opacity 0.15s;
}

.btn-start:hover {
  opacity: 0.85;
}

.btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-add {
  padding: 0.5rem 1rem;
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

.btn-add:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

.btn-action {
  padding: 0.5rem 1rem;
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

.btn-remove {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: #ba1a1a;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #ba1a1a;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: background-color 0.15s;
}

.btn-remove:hover {
  background-color: #ffebee;
}

.btn-action .material-symbols-outlined,
.btn-remove .material-symbols-outlined,
.btn-add .material-symbols-outlined {
  font-size: 1rem;
}
</style>
