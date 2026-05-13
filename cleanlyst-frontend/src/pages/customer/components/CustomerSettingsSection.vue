<template>
  <main class="page-main">
    <section class="page-header">
      <div>
        <h1 class="header-title">Settings</h1>
        <p class="header-sub">Manage your account details and security.</p>
      </div>
    </section>

    <!-- Personal Information -->
    <div class="form-card">
      <div class="card-heading-row">
        <h2 class="card-heading">Personal Information</h2>
        <button class="btn-ghost" type="button" @click="editingProfile ? cancelEditProfile() : openEditProfile()">
          <span class="material-symbols-outlined btn-ghost-icon">{{ editingProfile ? 'close' : 'edit' }}</span>
          {{ editingProfile ? 'Cancel' : 'Edit' }}
        </button>
      </div>

      <!-- Read-only view -->
      <div v-if="!editingProfile" class="profile-view">
        <div class="avatar-row">
          <div class="avatar-wrap">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Profile" class="avatar-img" />
            <span v-else class="material-symbols-outlined avatar-placeholder">person</span>
          </div>
          <div class="avatar-actions">
            <label class="btn-secondary" :class="{ 'btn-secondary--loading': avatarUploading }">
              <input
                accept="image/jpeg,image/png,image/webp"
                class="sr-only"
                type="file"
                :disabled="avatarUploading"
                @change="handleAvatarChange"
              />
              {{ avatarUploading ? 'Uploading…' : 'Change Photo' }}
            </label>
            <p v-if="avatarError" class="avatar-error">{{ avatarError }}</p>
          </div>
        </div>
        <dl class="profile-dl">
          <div class="profile-dl-row">
            <dt class="profile-dt">Full Name</dt>
            <dd class="profile-dd">{{ auth.profile?.full_name || '—' }}</dd>
          </div>
          <div class="profile-dl-row">
            <dt class="profile-dt">Phone</dt>
            <dd class="profile-dd">{{ auth.profile?.phone || '—' }}</dd>
          </div>
          <div class="profile-dl-row">
            <dt class="profile-dt">City</dt>
            <dd class="profile-dd">{{ auth.profile?.city || '—' }}</dd>
          </div>
          <div class="profile-dl-row">
            <dt class="profile-dt">Country</dt>
            <dd class="profile-dd">{{ auth.profile?.country || '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Edit form -->
      <div v-else>
        <div class="avatar-row">
          <div class="avatar-wrap">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Profile" class="avatar-img" />
            <span v-else class="material-symbols-outlined avatar-placeholder">person</span>
          </div>
          <div class="avatar-actions">
            <label class="btn-secondary" :class="{ 'btn-secondary--loading': avatarUploading }">
              <input
                accept="image/jpeg,image/png,image/webp"
                class="sr-only"
                type="file"
                :disabled="avatarUploading"
                @change="handleAvatarChange"
              />
              {{ avatarUploading ? 'Uploading…' : 'Change Photo' }}
            </label>
            <p v-if="avatarError" class="avatar-error">{{ avatarError }}</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="fullName">Full Name</label>
            <input
              id="fullName"
              v-model="profileForm.fullName"
              class="form-input"
              type="text"
              placeholder="Your full name"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="phone">Phone Number</label>
            <input
              id="phone"
              v-model="profileForm.phone"
              class="form-input"
              type="tel"
              placeholder="+44 7700 000000"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="city">City</label>
            <select id="city" v-model="profileForm.city" class="form-input">
              <option value="">Select a city</option>
              <option v-for="c in UK_CITIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="country">Country</label>
            <input
              id="country"
              v-model="profileForm.country"
              class="form-input"
              type="text"
              placeholder="Your country"
            />
          </div>
        </div>
        <div class="card-footer">
          <p v-if="profileStatus === 'success'" class="save-success">
            <span class="material-symbols-outlined save-icon">check_circle</span>
            Profile updated successfully.
          </p>
          <p v-else-if="profileStatus === 'error'" class="save-error">{{ profileError }}</p>
          <button class="btn-primary" :disabled="profileSaving" type="button" @click="saveProfile">
            {{ profileSaving ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Email Address -->
    <div class="form-card">
      <h2 class="card-heading">Email Address</h2>
      <div class="form-group form-group--last">
        <label class="form-label" for="email">Email</label>
        <input
          id="email"
          :value="userEmail"
          class="form-input form-input--readonly"
          readonly
          type="email"
        />
        <p class="field-hint">To change your email address, please contact support.</p>
      </div>
    </div>

    <!-- Change Password -->
    <div class="form-card">
      <h2 class="card-heading">Change Password</h2>
      <div class="form-group">
        <label class="form-label" for="newPassword">New Password</label>
        <input
          id="newPassword"
          v-model="passwordForm.newPassword"
          class="form-input"
          type="password"
          placeholder="At least 8 characters"
        />
      </div>
      <div class="form-group form-group--last">
        <label class="form-label" for="confirmPassword">Confirm New Password</label>
        <input
          id="confirmPassword"
          v-model="passwordForm.confirmPassword"
          class="form-input"
          type="password"
          placeholder="Repeat your new password"
        />
        <p v-if="passwordMismatch" class="field-error">Passwords do not match.</p>
      </div>
      <div class="card-footer">
        <p v-if="passwordStatus === 'success'" class="save-success">
          <span class="material-symbols-outlined save-icon">check_circle</span>
          Password updated successfully.
        </p>
        <p v-else-if="passwordStatus === 'error'" class="save-error">{{ passwordError }}</p>
        <button
          class="btn-primary"
          :disabled="passwordSaving || !canChangePassword"
          type="button"
          @click="savePassword"
        >
          {{ passwordSaving ? 'Updating…' : 'Update Password' }}
        </button>
      </div>
    </div>

    <!-- Notifications -->
    <div class="form-card">
      <h2 class="card-heading">Notifications</h2>
      <div class="toggle-list">
        <div class="toggle-row">
          <div class="toggle-info">
            <p class="toggle-label">Email Notifications</p>
            <p class="toggle-desc">Receive booking confirmations and updates via email</p>
          </div>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--on': notifications.email }"
            type="button"
            :aria-pressed="notifications.email"
            @click="notifications.email = !notifications.email"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
        <div class="toggle-row toggle-row--last">
          <div class="toggle-info">
            <p class="toggle-label">SMS Reminders</p>
            <p class="toggle-desc">Receive a text reminder before each scheduled clean</p>
          </div>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--on': notifications.sms }"
            type="button"
            :aria-pressed="notifications.sms"
            @click="notifications.sms = !notifications.sms"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'
import { uploadAvatar } from '@/services/storageService'
import { UK_CITIES } from '@/utils/ukCities'

const auth = useAuthStore()

const userEmail = ref('')
const avatarUrl = ref(auth.profile?.avatar_url ?? '')
const avatarUploading = ref(false)
const avatarError = ref('')

const editingProfile = ref(false)
const profileSaving = ref(false)
const profileStatus = ref<'idle' | 'success' | 'error'>('idle')
const profileError = ref('')

const passwordSaving = ref(false)
const passwordStatus = ref<'idle' | 'success' | 'error'>('idle')
const passwordError = ref('')

const profileForm = reactive({
  fullName: '',
  phone: '',
  city: '',
  country: '',
})

function syncFormFromStore() {
  profileForm.fullName = auth.profile?.full_name ?? ''
  profileForm.phone = auth.profile?.phone ?? ''
  profileForm.city = auth.profile?.city ?? ''
  profileForm.country = auth.profile?.country ?? ''
}

function openEditProfile() {
  syncFormFromStore()
  profileStatus.value = 'idle'
  profileError.value = ''
  editingProfile.value = true
}

function cancelEditProfile() {
  editingProfile.value = false
  profileStatus.value = 'idle'
  profileError.value = ''
}

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: '',
})

const NOTIF_KEY = 'cleanlyst_notif_prefs'

function loadNotifPrefs(): { email: boolean; sms: boolean } {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse errors
  }
  return { email: true, sms: false }
}

const notifications = reactive(loadNotifPrefs())

watch(
  () => ({ email: notifications.email, sms: notifications.sms }),
  (prefs) => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs))
    } catch {
      // ignore storage errors (private browsing, quota exceeded)
    }
  },
)

const passwordMismatch = computed(
  () =>
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword,
)

const canChangePassword = computed(
  () =>
    passwordForm.newPassword.length >= 8 &&
    passwordForm.newPassword === passwordForm.confirmPassword,
)

onMounted(async () => {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getUser()
  userEmail.value = data.user?.email ?? ''
})

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
    avatarUrl.value = publicUrl
    await auth._loadProfileData(auth.userId)
  } catch (err) {
    avatarError.value = err instanceof Error ? err.message : 'Failed to upload photo.'
  } finally {
    avatarUploading.value = false
  }
}

async function saveProfile() {
  if (!auth.userId) return
  profileSaving.value = true
  profileStatus.value = 'idle'
  profileError.value = ''
  try {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileForm.fullName.trim() || null,
        phone: profileForm.phone || null,
        city: profileForm.city || null,
        country: profileForm.country || null,
      })
      .eq('id', auth.userId)
    if (error) throw error
    await auth._loadProfileData(auth.userId)
    profileStatus.value = 'success'
    setTimeout(() => {
      profileStatus.value = 'idle'
      editingProfile.value = false
    }, 1500)
  } catch (err) {
    profileStatus.value = 'error'
    profileError.value = err instanceof Error ? err.message : 'Failed to update profile.'
  } finally {
    profileSaving.value = false
  }
}

async function savePassword() {
  if (!canChangePassword.value) return
  passwordSaving.value = true
  passwordStatus.value = 'idle'
  passwordError.value = ''
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
    if (error) throw error
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordStatus.value = 'success'
    setTimeout(() => {
      passwordStatus.value = 'idle'
    }, 3000)
  } catch (err) {
    passwordStatus.value = 'error'
    passwordError.value = err instanceof Error ? err.message : 'Failed to update password.'
  } finally {
    passwordSaving.value = false
  }
}
</script>

<style scoped>
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

.page-main {
  padding: 2rem 1.5rem 6rem;
  max-width: 80rem;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-title {
  font-family: var(--font-h2);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.25rem;
}

.header-sub {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Card heading row ── */
.card-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.card-heading-row .card-heading {
  margin: 0;
  padding: 0;
  border: none;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: var(--radius, 0.25rem);
  font-size: 13px;
  font-weight: 500;
  color: var(--on-surface, #1a1c1c);
  cursor: pointer;
  transition: border-color 200ms ease;
  flex-shrink: 0;
}

.btn-ghost:hover {
  border-color: var(--primary, #000000);
}

.btn-ghost-icon {
  font-size: 16px;
}

/* ── Read-only profile view ── */
.profile-dl {
  margin: 0;
}

.profile-dl-row {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.profile-dl-row:last-child {
  border-bottom: none;
}

.profile-dt {
  font-size: 13px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  width: 7rem;
  flex-shrink: 0;
}

.profile-dd {
  font-size: 14px;
  color: var(--on-surface, #1a1c1c);
  margin: 0;
  word-break: break-word;
}

/* ── Avatar ── */
.avatar-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.avatar-wrap {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--surface-container, #eeeeee);
  border: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 2rem;
  color: var(--secondary, #5e5e5e);
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.avatar-error {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--error, #ba1a1a);
  margin: 0;
}

/* ── Form card ── */
.form-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  border-radius: 0.25rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.card-heading {
  font-family: var(--font-label-md);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

/* ── Form grid ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

/* ── Form groups ── */
.form-group {
  margin-bottom: 1.25rem;
}

.form-group--last {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-family: var(--font-label-md);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface, #1a1c1c);
  margin-bottom: 0.5rem;
}

/* ── Inputs ── */
.form-input {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface, #1a1c1c);
  background: #ffffff;
  transition: border-color 200ms ease;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--primary, #000000);
}

.form-input--readonly {
  background: var(--surface-container, #eeeeee);
  color: var(--secondary, #5e5e5e);
  cursor: not-allowed;
}

/* ── Field hints ── */
.field-hint {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0.375rem 0 0;
}

.field-error {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--error, #ba1a1a);
  margin: 0.375rem 0 0;
}

/* ── Card footer ── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--surface-container, #eeeeee);
}

/* ── Toggle list ── */
.toggle-list {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.toggle-row--last {
  border-bottom: none;
  padding-bottom: 0;
}

.toggle-info {
  flex: 1;
}

.toggle-label {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.125rem;
}

.toggle-desc {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.toggle-btn {
  width: 3rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: var(--surface-container, #eeeeee);
  position: relative;
  cursor: pointer;
  transition:
    background-color 200ms ease,
    border-color 200ms ease;
  padding: 0;
  flex-shrink: 0;
}

.toggle-btn--on {
  background: var(--primary, #000000);
  border-color: var(--primary, #000000);
}

.toggle-knob {
  position: absolute;
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #ffffff;
  transition: left 200ms ease;
  pointer-events: none;
}

.toggle-btn--on .toggle-knob {
  left: calc(100% - 19px);
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.5rem;
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 200ms ease;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--on-surface, #1a1c1c);
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-label-md);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 200ms ease;
}

.btn-secondary:hover {
  border-color: var(--primary, #000000);
}

.btn-secondary--loading {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Feedback ── */
.save-success {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-caption);
  font-size: 13px;
  color: #2e7d32;
  margin: 0;
}

.save-error {
  font-family: var(--font-caption);
  font-size: 13px;
  color: var(--error, #ba1a1a);
  margin: 0;
}

.save-icon {
  font-size: 1rem;
}

@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}
</style>
