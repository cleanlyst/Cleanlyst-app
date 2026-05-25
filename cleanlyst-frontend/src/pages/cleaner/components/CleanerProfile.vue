<template>
  <main class="page-main">
    <!-- Self View Header -->
    <div class="profile-header">
      <div class="profile-header-text">
        <h1 class="profile-title">Your Public Profile</h1>
        <p class="profile-subtitle">
          This is how potential clients see your professional profile. Ensure your details and
          portfolio are up to date to increase bookings.
        </p>
      </div>
      <button class="edit-btn" @click="editing ? closeEdit() : openEdit()">
        <span class="material-symbols-outlined">{{ editing ? 'close' : 'edit' }}</span>
        <span class="edit-btn-label">{{ editing ? 'Cancel' : 'Edit Profile' }}</span>
      </button>
    </div>

    <!-- Edit Form (inline) -->
    <div v-if="editing" class="card edit-card">
      <h2 class="card-heading">Edit Profile</h2>
      <div class="edit-grid">
        <div class="edit-group">
          <label class="edit-label" for="ep-name">Full Name</label>
          <input
            id="ep-name"
            v-model="editForm.full_name"
            class="edit-input"
            type="text"
            placeholder="Your full name"
          />
        </div>
        <div class="edit-group">
          <label class="edit-label" for="ep-city">City</label>
          <select id="ep-city" v-model="editForm.city" class="edit-input">
            <option value="">Select a city</option>
            <option v-for="c in ROLLOUT_CONFIG.cities" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="edit-group edit-group--full">
          <label class="edit-label" for="ep-bio">Bio</label>
          <textarea
            id="ep-bio"
            v-model="editForm.bio"
            class="edit-textarea"
            rows="4"
            placeholder="Describe your experience and services…"
          ></textarea>
        </div>
        <div class="edit-group">
          <label class="edit-label" for="ep-radius">Service Radius (km)</label>
          <input
            id="ep-radius"
            v-model.number="editForm.service_radius_km"
            class="edit-input"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 20"
          />
        </div>
        <div class="edit-group">
          <label class="edit-label" for="ep-avatar">Profile Photo</label>
          <label
            id="ep-avatar"
            class="avatar-upload-btn"
            :class="{ 'avatar-upload-btn--loading': avatarUploading }"
          >
            <input
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              type="file"
              :disabled="avatarUploading"
              @change="handleAvatarChange"
            />
            {{ avatarUploading ? 'Uploading…' : 'Upload New Photo' }}
          </label>
          <p v-if="avatarError" class="edit-error">{{ avatarError }}</p>
        </div>
      </div>
      <div class="edit-footer">
        <p v-if="editError" class="edit-error">{{ editError }}</p>
        <p v-if="editSuccess" class="edit-success">
          <span class="material-symbols-outlined" style="font-size: 1rem">check_circle</span>
          Profile updated.
        </p>
        <button class="edit-save-btn" :disabled="editSaving" @click="handleSaveEdit">
          {{ editSaving ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <!-- Main Bento Layout -->
    <div class="profile-grid">
      <!-- Left Column: Identity & Stats -->
      <div class="profile-left">
        <!-- Profile Card -->
        <div class="card">
          <div class="profile-card-inner">
            <div class="avatar">
              <img
                v-if="auth.profile?.avatar_url"
                class="avatar-img"
                :alt="auth.profile.full_name"
                :src="auth.profile.avatar_url"
              />
              <span v-else class="material-symbols-outlined avatar-placeholder">person</span>
            </div>
            <h2 class="cleaner-name">{{ auth.profile?.full_name ?? '—' }}</h2>
            <p class="cleaner-title">{{ auth.cleanerProfile?.business_name ?? 'Cleaner' }}</p>
            <div v-if="(auth.cleanerProfile?.review_count ?? 0) > 0" class="rating-row">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1"
                >star</span
              >
              <span class="rating-label">
                {{ auth.cleanerProfile?.average_rating?.toFixed(1) }}
                ({{ auth.cleanerProfile?.review_count }} reviews)
              </span>
            </div>
            <div class="stats-grid">
              <div class="stat-cell">
                <span class="stat-value">
                  {{ auth.cleanerProfile?.service_radius_km ?? '—' }}km
                </span>
                <span class="stat-caption">Service Radius</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div class="card card--spaced">
          <h3 class="section-label">Account Status</h3>
          <div class="tags-row">
            <span class="tag" :class="statusTagClass">{{ statusTagLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Bio -->
      <div class="profile-right">
        <!-- Bio Section -->
        <div class="card">
          <h2 class="card-heading">About Me</h2>
          <div v-if="auth.cleanerProfile?.bio" class="bio-body">
            <p>{{ auth.cleanerProfile.bio }}</p>
          </div>
          <p v-else class="bio-empty">
            No bio yet. Click <strong>Edit Profile</strong> to add one.
          </p>
        </div>

        <!-- Service Area -->
        <div v-if="auth.profile?.city" class="card">
          <h2 class="card-heading">Service Area</h2>
          <div class="map-pin">
            <span class="material-symbols-outlined map-pin-icon">location_on</span>
            <p class="map-pin-text">
              {{ auth.profile.city
              }}{{
                auth.cleanerProfile?.service_radius_km
                  ? ` — within ${auth.cleanerProfile.service_radius_km} km`
                  : ''
              }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { uploadAvatar } from '@/services/storageService'
import { ROLLOUT_CONFIG } from '@/config/rollout'

const auth = useAuthStore()

const editing = ref(false)
const editSaving = ref(false)
const editError = ref('')
const editSuccess = ref(false)
const avatarUploading = ref(false)
const avatarError = ref('')

const editForm = reactive({
  full_name: '',
  bio: '',
  service_radius_km: null as number | null,
  city: '',
})

function syncFormFromStore() {
  editForm.full_name = auth.profile?.full_name ?? ''
  editForm.bio = auth.cleanerProfile?.bio ?? ''
  editForm.service_radius_km = auth.cleanerProfile?.service_radius_km ?? null
  editForm.city = auth.profile?.city ?? ''
}

function openEdit() {
  syncFormFromStore()
  editError.value = ''
  editSuccess.value = false
  editing.value = true
}

function closeEdit() {
  editing.value = false
  editError.value = ''
  editSuccess.value = false
}

// profiles.role is the authoritative source — cleanerProfile.status can lag behind
// when an admin changes the role directly in the DB without going through the
// approval Edge Function that updates both columns together.
const statusTagLabel = computed(() => {
  switch (auth.profile?.role) {
    case 'cleaner_active':
      return 'ACTIVE'
    case 'cleaner_pending': {
      // Distinguish rejected/suspended sub-states from a plain pending review
      if (auth.cleanerProfile?.status === 'rejected') return 'REJECTED'
      if (auth.cleanerProfile?.status === 'suspended') return 'SUSPENDED'
      return 'PENDING APPROVAL'
    }
    default:
      return 'PENDING'
  }
})

const statusTagClass = computed(() => {
  if (auth.profile?.role === 'cleaner_active') return 'tag--active'
  if (auth.cleanerProfile?.status === 'rejected' || auth.cleanerProfile?.status === 'suspended')
    return 'tag--error'
  return ''
})

async function handleSaveEdit() {
  if (!auth.userId) return

  const trimmedName = editForm.full_name.trim()
  if (!trimmedName) {
    editError.value = 'Full name is required.'
    return
  }

  editSaving.value = true
  editError.value = ''
  editSuccess.value = false
  try {
    const supabase = requireSupabase()

    // full_name + city live on profiles; bio/rate/radius live on cleaner_profiles.
    const [profileResult, cleanerResult] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          city: editForm.city || null,
        })
        .eq('id', auth.userId),
      // Upsert — handles the case where admin promoted the user directly and no
      // cleaner_profiles row exists yet.
      supabase.from('cleaner_profiles').upsert(
        {
          user_id: auth.userId,
          bio: editForm.bio.trim() || null,
          service_radius_km: editForm.service_radius_km,
        },
        { onConflict: 'user_id' },
      ),
    ])

    if (profileResult.error) throw profileResult.error
    if (cleanerResult.error) throw cleanerResult.error

    // Reload profile data — required to reflect changes in the display
    await auth._loadProfileData(auth.userId)
    syncFormFromStore()

    editSuccess.value = true
    setTimeout(() => {
      editSuccess.value = false
      editing.value = false
    }, 1500)
  } catch (err) {
    editError.value = err instanceof Error ? err.message : 'Failed to save changes.'
  } finally {
    editSaving.value = false
  }
}

async function handleAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !auth.userId) return
  avatarUploading.value = true
  avatarError.value = ''
  try {
    const publicUrl = await uploadAvatar(auth.userId, file)
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', auth.userId)
    if (error) throw error
    await auth._loadProfileData(auth.userId)
  } catch (err) {
    avatarError.value = err instanceof Error ? err.message : 'Failed to upload photo.'
  } finally {
    avatarUploading.value = false
  }
}
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Material Symbols ───────────────────────────────────────────── */
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

/* ── Page Root ──────────────────────────────────────────────────── */
.page-main {
  background-color: var(--surface-container-lowest);
  color: var(--on-surface);
  padding-top: 2rem;
  padding-bottom: 96px;
  padding-left: 24px;
  padding-right: 24px;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  font-family: 'Inter', sans-serif;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 48px;
    padding-right: 48px;
  }
}

/* ── Profile Header ─────────────────────────────────────────────── */
.profile-header {
  margin-bottom: 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 768px) {
  .profile-header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.profile-header-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.self-view-badge {
  display: inline-block;
  background-color: var(--surface-container-high);
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 0.125rem;
  border: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

.profile-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--on-surface);
  margin: 0;
}

.profile-subtitle {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface-variant);
  max-width: 42rem;
  margin: 0;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary);
  color: var(--on-primary);
  padding: 12px 32px;
  border-radius: 0.125rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.edit-btn:hover {
  opacity: 0.9;
}

.edit-btn:active {
  transform: scale(0.95);
}

.edit-btn-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

/* ── Profile Grid ───────────────────────────────────────────────── */
.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-grid {
    grid-template-columns: repeat(12, 1fr);
  }
}

.profile-left {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-left {
    grid-column: span 4;
  }
}

.profile-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-right {
    grid-column: span 8;
  }
}

/* ── Card ───────────────────────────────────────────────────────── */
.card {
  background-color: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  padding: 24px;
}

.card--spaced {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Profile Card Inner ─────────────────────────────────────────── */
.profile-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.avatar {
  width: 128px;
  height: 128px;
  margin-bottom: 24px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--outline-variant);
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%);
}

.cleaner-name {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 4px;
}

.cleaner-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface-variant);
  margin: 0 0 16px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  margin-bottom: 24px;
}

.rating-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.stats-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--outline-variant);
  padding-top: 24px;
  gap: 16px;
}

.stat-cell {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
}

.stat-caption {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--on-surface-variant);
}

/* ── Section Label ──────────────────────────────────────────────── */
.section-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
  margin: 0;
}

.section-label--mb {
  margin-bottom: 16px;
}

/* ── Tags ───────────────────────────────────────────────────────── */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 8px;
  background-color: var(--surface-container);
  font-size: 10px;
  font-weight: 700;
  border: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

.tag--active {
  background-color: #e8f5e9;
  border-color: #a5d6a7;
  color: #2e7d32;
}

.tag--error {
  background-color: #fce4ec;
  border-color: #f48fb1;
  color: #c62828;
}

/* ── Avatar placeholder ─────────────────────────────────────────── */
.avatar-placeholder {
  font-size: 3rem;
  color: var(--on-surface-variant);
}

/* ── Bio empty state ────────────────────────────────────────────── */
.bio-empty {
  font-size: 14px;
  color: var(--on-surface-variant);
  margin: 0;
}

/* ── Edit card ──────────────────────────────────────────────────── */
.edit-card {
  margin-bottom: 24px;
}

.edit-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

@media (min-width: 640px) {
  .edit-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.edit-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .edit-group--full {
    grid-column: span 2;
  }
}

.edit-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--on-surface);
}

.edit-input,
.edit-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--outline-variant);
  font-size: 16px;
  line-height: 1.6;
  color: var(--on-surface);
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 200ms ease;
}

.edit-input:focus,
.edit-textarea:focus {
  border-color: var(--primary);
}

.edit-textarea {
  resize: vertical;
  min-height: 100px;
}

.avatar-upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border: 1px solid var(--outline-variant);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 200ms ease;
  color: var(--on-surface);
}

.avatar-upload-btn:hover {
  border-color: var(--primary);
}

.avatar-upload-btn--loading {
  opacity: 0.5;
  pointer-events: none;
}

.edit-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--outline-variant);
  flex-wrap: wrap;
}

.edit-save-btn {
  padding: 0.625rem 1.5rem;
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 200ms ease;
}

.edit-save-btn:hover {
  opacity: 0.9;
}
.edit-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-error {
  font-size: 13px;
  color: var(--error, #ba1a1a);
  margin: 0;
}

.edit-success {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 13px;
  color: #2e7d32;
  margin: 0;
}

/* ── Skills ─────────────────────────────────────────────────────── */
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-name {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface);
}

.skill-icon {
  color: var(--primary);
}

/* ── Card Heading ───────────────────────────────────────────────── */
.card-heading {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 24px;
}

/* ── Bio ────────────────────────────────────────────────────────── */
.bio-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface-variant);
}

.bio-body p {
  margin: 0;
}

/* ── Portfolio ──────────────────────────────────────────────────── */
.portfolio-wrapper {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .portfolio-wrapper {
    grid-template-columns: repeat(2, 1fr);
  }
}

.card--full-span {
  background-color: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  padding: 24px;
}

@media (min-width: 768px) {
  .card--full-span {
    grid-column: span 2;
  }
}

.portfolio-images {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .portfolio-images {
    grid-template-columns: repeat(3, 1fr);
  }
}

.portfolio-item {
  aspect-ratio: 1 / 1;
  background-color: var(--surface-container);
  border: 1px solid var(--outline-variant);
  overflow: hidden;
}

.portfolio-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.portfolio-img:hover {
  transform: scale(1.05);
}

.portfolio-add {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.portfolio-add:hover {
  background-color: var(--surface-variant);
}

.add-photo-inner {
  text-align: center;
}

.add-photo-icon {
  font-size: 36px;
  color: var(--on-surface-variant);
  display: block;
}

.add-photo-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  margin-top: 8px;
  color: var(--on-surface);
}

/* ── Service Map ────────────────────────────────────────────────── */
.service-map {
  width: 100%;
  height: 256px;
  background-color: var(--surface-container);
  border: 1px solid var(--outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.map-bg {
  position: absolute;
  inset: 0;
  filter: grayscale(100%);
  opacity: 0.4;
}

.map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-pin {
  position: relative;
  z-index: 10;
  background-color: #ffffff;
  padding: 16px 24px;
  border: 1px solid var(--outline-variant);
  text-align: center;
}

.map-pin-icon {
  font-size: 30px;
  display: block;
  margin-bottom: 8px;
  color: var(--on-surface);
}

.map-pin-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface);
  margin: 0;
}
</style>
