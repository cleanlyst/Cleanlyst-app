<template>
  <main class="page-main">
    <div class="page-header">
      <h1 class="page-title">Set Pricing &amp; Availability</h1>
      <p class="page-desc">
        Define your service rates and operational parameters. Changes to pricing will not affect
        existing active bookings.
      </p>
    </div>
    <div class="form-grid">
      <!-- Left Column: Form Controls -->
      <div class="left-col">
        <!-- Pricing Section -->
        <section class="form-section">
          <div class="section-head">
            <span class="material-symbols-outlined section-icon">payments</span>
            <h2 class="section-title">Hourly Rate</h2>
          </div>
          <div class="form-card">
            <label class="form-label" for="base-hourly-price">Base Hourly Price (£)</label>
            <div class="price-input-wrap">
              <span class="price-prefix">£</span>
              <input id="base-hourly-price" class="price-input" placeholder="45.00" type="number" />
            </div>
            <p class="input-hint">Recommended range in your area: £35 - £55</p>
          </div>
        </section>
        <!-- Service Radius Section -->
        <section class="form-section">
          <div class="section-head">
            <span class="material-symbols-outlined section-icon">map</span>
            <h2 class="section-title">Travel Radius</h2>
          </div>
          <div class="radius-card">
            <div>
              <div class="radius-header">
                <label class="form-label" for="travel-radius">Max Distance (miles)</label>
                <span class="radius-value">25<span class="radius-value-unit">mi</span></span>
              </div>
              <input
                id="travel-radius"
                class="radius-slider"
                max="100"
                min="5"
                step="5"
                type="range"
                value="25"
              />
            </div>
            <div class="map-preview">
              <img
                class="map-preview-img"
                alt="A minimalist overhead topographic map of a modern urban city layout with clean white streets and subtle grey building masses. The lighting is bright and even, evoking a professional architectural drafting style. A faint circular overlay indicates a service radius area in a translucent grey tone, maintaining a monochromatic and functional aesthetic."
                data-location="New York City"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCaAwSAOBQnJMyE8G_7IR20zlwDj5f1oG8fRuPpgK19zq9Hn8Y-rzLtUbqb_glHKqXAfYwjiKLc0hDGNErlobbHCmyWEMHzIHOy-i7-oECrBB3VeifUOMPfGRj-4ZdwilTypW4z3uki7Jtl1jjgW2rgEhBV8TbparbSlbcoq49Zm1DMWyYK__FHVnXCxc9g9CrhCjUo9C5aLBs8X3SBOXeAPP4uD2FgraIKXpsgvuSiikJ3ea3Q9QKQdAxA7vB9OZ-mBq8LD9Fbiw"
              />
              <div class="map-overlay">
                <div class="map-pulse"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <!-- Right Column: Availability Calendar -->
      <div class="right-col">
        <section class="schedule-section">
          <div class="schedule-header">
            <div class="schedule-head-left">
              <span class="material-symbols-outlined section-icon">calendar_month</span>
              <h2 class="section-title">Weekly Schedule</h2>
            </div>
            <button class="copy-all-btn">Copy to all days</button>
          </div>
          <div class="schedule-card">
            <div class="day-rows">
              <!-- Monday -->
              <div class="day-row">
                <div class="day-name-col">
                  <span class="day-name">Monday</span>
                  <span class="day-status">Available</span>
                </div>
                <div class="time-inputs">
                  <input class="time-input" type="time" value="09:00" />
                  <span class="time-sep">to</span>
                  <input class="time-input" type="time" value="17:00" />
                </div>
                <label class="day-toggle-wrap" aria-label="Monday availability">
                  <input
                    checked
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    aria-label="Monday availability"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
              <!-- Tuesday -->
              <div class="day-row">
                <div class="day-name-col">
                  <span class="day-name">Tuesday</span>
                  <span class="day-status">Available</span>
                </div>
                <div class="time-inputs">
                  <input class="time-input" type="time" value="09:00" />
                  <span class="time-sep">to</span>
                  <input class="time-input" type="time" value="17:00" />
                </div>
                <label class="day-toggle-wrap" aria-label="Tuesday availability">
                  <input
                    checked
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    aria-label="Tuesday availability"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
              <!-- Wednesday (Off) -->
              <div class="day-row day-row--off">
                <div class="day-name-col">
                  <span class="day-name day-name--muted">Wednesday</span>
                  <span class="day-status day-status--off">Off</span>
                </div>
                <div class="time-inputs time-inputs--disabled">
                  <input class="time-input" type="time" value="00:00" />
                  <span class="time-sep">to</span>
                  <input class="time-input" type="time" value="00:00" />
                </div>
                <label class="day-toggle-wrap" aria-label="Wednesday availability">
                  <input
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    aria-label="Wednesday availability"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
              <!-- Thursday -->
              <div class="day-row">
                <div class="day-name-col">
                  <span class="day-name">Thursday</span>
                  <span class="day-status">Available</span>
                </div>
                <div class="time-inputs">
                  <input class="time-input" type="time" value="09:00" />
                  <span class="time-sep">to</span>
                  <input class="time-input" type="time" value="17:00" />
                </div>
                <label class="day-toggle-wrap" aria-label="Thursday availability">
                  <input
                    checked
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    aria-label="Thursday availability"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
              <!-- Friday -->
              <div class="day-row">
                <div class="day-name-col">
                  <span class="day-name">Friday</span>
                  <span class="day-status">Available</span>
                </div>
                <div class="time-inputs">
                  <input class="time-input" type="time" value="09:00" />
                  <span class="time-sep">to</span>
                  <input class="time-input" type="time" value="15:00" />
                </div>
                <label class="day-toggle-wrap" aria-label="Friday availability">
                  <input
                    checked
                    class="sr-only day-toggle-input"
                    type="checkbox"
                    aria-label="Friday availability"
                  />
                  <div class="day-toggle"></div>
                </label>
              </div>
            </div>
          </div>
          <div class="form-footer">
            <button class="btn-discard">Discard Changes</button>
            <button class="btn-save">Save Settings</button>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  calendarDays: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
})
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
  .left-col {
    grid-column: span 5;
  }
  .right-col {
    grid-column: span 7;
  }
}

.left-col {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

/* ── Form Sections ── */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-icon {
  color: #a1a1aa; /* zinc-400 */
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  font-family: var(--font-h2, Inter, sans-serif);
  color: var(--primary, #000000);
}

/* ── Form Card ── */
.form-card {
  padding: 2rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  font-family: var(--font-label-md, Inter, sans-serif);
  margin-bottom: 0.5rem;
  color: #52525b; /* zinc-600 */
}

/* ── Price Input ── */
.price-input-wrap {
  position: relative;
}

.price-prefix {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #a1a1aa; /* zinc-400 */
  pointer-events: none;
}

.price-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.125rem;
  outline: none;
  transition: border-color 150ms;
  font-size: 16px;
  font-family: var(--font-body, Inter, sans-serif);
  box-sizing: border-box;
}

.price-input:focus {
  border-color: var(--primary, #000000);
}

.input-hint {
  margin-top: 1rem;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  font-family: var(--font-caption, Inter, sans-serif);
  color: #a1a1aa; /* zinc-400 */
}

/* ── Radius Card ── */
.radius-card {
  padding: 2rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.radius-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1rem;
}

.radius-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  font-family: var(--font-h2, Inter, sans-serif);
  color: var(--primary, #000000);
}

.radius-value-unit {
  font-size: 0.875rem;
  font-weight: 400;
  color: #a1a1aa; /* zinc-400 */
  margin-left: 0.25rem;
}

.radius-slider {
  width: 100%;
  height: 0.25rem;
  background-color: var(--surface-container, #eeeeee);
  appearance: none;
  cursor: pointer;
  accent-color: var(--primary, #000000);
  border-radius: 9999px;
}

/* ── Map Preview ── */
.map-preview {
  height: 12rem;
  width: 100%;
  background-color: var(--surface-container, #eeeeee);
  border-radius: 0.125rem;
  overflow: hidden;
  position: relative;
}

.map-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%);
  opacity: 0.5;
}

.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-pulse {
  width: 6rem;
  height: 6rem;
  border-radius: 9999px;
  border: 2px solid var(--primary, #000000);
  background-color: rgba(0, 0, 0, 0.05);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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

.copy-all-btn {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  font-family: var(--font-label-md, Inter, sans-serif);
  color: #71717a; /* zinc-500 */
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  transition: color 150ms;
}

.copy-all-btn:hover {
  color: var(--primary, #000000);
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
  border-bottom: 1px solid #f4f4f5; /* zinc-100 */
  transition: background-color 150ms;
}

.day-row:last-child {
  border-bottom: none;
}

.day-row:hover {
  background-color: rgba(250, 250, 250, 0.5); /* zinc-50/50 */
}

@media (min-width: 640px) {
  .day-row {
    flex-direction: row;
    align-items: center;
  }
}

.day-row--off {
  background-color: rgba(250, 250, 250, 0.3); /* zinc-50/30 */
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
  color: #a1a1aa; /* zinc-400 */
}

.day-status {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  text-transform: uppercase;
  color: #a1a1aa; /* zinc-400 */
  letter-spacing: 0.05em;
}

.day-status--off {
  color: #d4d4d8; /* zinc-300 */
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
  color: #d4d4d8; /* zinc-300 */
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
  background: #e4e4e7; /* zinc-200 */
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

.btn-discard:hover {
  background-color: #fafafa; /* zinc-50 */
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
  transition: transform 150ms;
}

.btn-save:active {
  transform: scale(0.95);
}
</style>
