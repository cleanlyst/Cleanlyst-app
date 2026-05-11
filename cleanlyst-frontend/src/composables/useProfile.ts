import { ref } from 'vue'
import { getProfile, updateProfile } from '@/services/profileService'
import { uploadAvatar } from '@/services/storageService'
import { useAuthStore } from '@/stores/auth'
import type { Profile } from '@/stores/auth'

export function useProfile() {
  const auth = useAuthStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const uploadingAvatar = ref(false)

  async function load(): Promise<Profile | null> {
    if (!auth.userId) return null
    loading.value = true
    error.value = null
    try {
      const profile = await getProfile(auth.userId)
      auth.profile = profile
      return profile
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profile'
      return null
    } finally {
      loading.value = false
    }
  }

  async function update(
    updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>,
  ): Promise<Profile | null> {
    if (!auth.userId) return null
    loading.value = true
    error.value = null
    try {
      const profile = await updateProfile(auth.userId, updates)
      auth.profile = profile
      return profile
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update profile'
      return null
    } finally {
      loading.value = false
    }
  }

  async function changeAvatar(file: File): Promise<string | null> {
    if (!auth.userId) return null
    uploadingAvatar.value = true
    error.value = null
    try {
      const publicUrl = await uploadAvatar(auth.userId, file)
      await update({ avatar_url: publicUrl })
      return publicUrl
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to upload avatar'
      return null
    } finally {
      uploadingAvatar.value = false
    }
  }

  return { loading, error, uploadingAvatar, load, update, changeAvatar }
}
