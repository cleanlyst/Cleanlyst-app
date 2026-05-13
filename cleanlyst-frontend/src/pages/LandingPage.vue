<template>
  <div class="max-w-3xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Book a Cleaner</h1>

    <div v-if="loading">Loading services...</div>

    <div v-else class="space-y-4">
      <div>
        <label class="block mb-1">Service</label>
        <select v-model="selectedServiceId" class="w-full border p-2 rounded">
          <option v-for="s in services" :key="s.id" :value="s.id">
            {{ s.title }} (£{{ s.base_price_cents / 100 }})
          </option>
        </select>
      </div>

      <div>
        <label class="block mb-1">Date & Time</label>
        <input type="datetime-local" v-model="datetime" class="w-full border p-2 rounded" />
      </div>

      <div>
        <label class="block mb-1">Address</label>
        <input v-model="location" class="w-full border p-2 rounded" />
      </div>

      <div>
        <label class="block mb-1">Notes</label>
        <textarea v-model="notes" class="w-full border p-2 rounded"></textarea>
      </div>

      <button @click="createBooking" class="bg-black text-white px-4 py-2 rounded">
        Request Booking
      </button>

      <p v-if="success" class="text-green-600">Booking request sent!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { createBookingRequest } from '@/services/bookingService'

interface Service {
  id: string
  title: string
  category: string | null
  description: string | null
  cleaner_id: string
  duration_minutes: number | null
  base_price_cents: number
}

const auth = useAuthStore()
const route = useRoute()

const services = ref<Service[]>([])
const loading = ref(true)

const selectedServiceId = ref<string | null>(null)
const datetime = ref('')
const location = ref('')
const notes = ref('')
const success = ref(false)

onMounted(async () => {
  await auth.init()

  let supabase
  try {
    supabase = requireSupabase()
  } catch (error) {
    console.error(error)
    alert(error instanceof Error ? error.message : 'Supabase is not configured')
    loading.value = false
    return
  }

  const { data, error } = await supabase.from('services').select('*').eq('active', true)

  if (error) {
    console.error(error)
    alert('Error loading services')
    loading.value = false
    return
  }

  services.value = (data ?? []) as Service[]
  selectedServiceId.value = preferredServiceId() ?? services.value[0]?.id ?? null
  loading.value = false
})

function preferredServiceId(): string | null {
  const requestedService = typeof route.query.service === 'string' ? route.query.service : ''
  if (!requestedService) return null

  return (
    services.value.find((service) => {
      const candidates = [service.title, service.category ?? ''].map(slugify)
      return candidates.includes(requestedService)
    })?.id ?? null
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function createBooking() {
  success.value = false

  let supabase
  try {
    supabase = requireSupabase()
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Supabase is not configured')
    return
  }

  if (!auth.userId) {
    alert('You must be logged in')
    return
  }

  if (!selectedServiceId.value || !datetime.value || !location.value.trim()) {
    alert('Please select a service, date, and address')
    return
  }

  const service = services.value.find((s) => s.id === selectedServiceId.value)
  if (!service) return

  const start = new Date(datetime.value)
  if (Number.isNaN(start.getTime())) {
    alert('Please enter a valid booking time')
    return
  }

  const end = new Date(start.getTime() + (service.duration_minutes || 60) * 60000)

  try {
    await createBookingRequest({
      customerId: auth.userId,
      cleanerId: service.cleaner_id,
      serviceId: service.id,
      serviceTitleSnapshot: service.title,
      categorySnapshot: service.category,
      descriptionSnapshot: service.description,
      locationText: location.value,
      notes: notes.value || null,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
      quoteCents: service.base_price_cents,
      cleanerPayoutCents: service.base_price_cents,
    })
  } catch (error) {
    console.error(error)
    alert('Error creating booking')
    return
  }

  success.value = true
  notes.value = ''
}
</script>
