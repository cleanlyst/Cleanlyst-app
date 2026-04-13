<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Cleaner Dashboard</h1>

    <div v-if="loading">Loading bookings...</div>

    <div v-else class="space-y-4">
      <div v-for="b in bookings" :key="b.id" class="border p-4 rounded shadow">
        <p class="font-semibold">{{ b.service_title_snapshot }}</p>
        <p>{{ new Date(b.scheduled_start).toLocaleString() }}</p>
        <p>{{ b.location_text }}</p>
        <p>Status: {{ b.status }}</p>

        <div v-if="b.status === 'pending'" class="mt-3 space-x-2">
          <button @click="acceptBooking(b.id)" class="bg-green-600 text-white px-3 py-1 rounded">
            Accept
          </button>

          <button @click="declineBooking(b.id)" class="bg-red-600 text-white px-3 py-1 rounded">
            Decline
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface Booking {
  id: string
  service_title_snapshot: string
  scheduled_start: string
  location_text: string
  status: string
  cleaner_id: string
  created_at: string
}

const bookings = ref<Booking[]>([])
const loading = ref(true)

onMounted(async () => {
  await auth.init()
  await loadBookings()
})

async function loadBookings() {
  if (!auth.userId) {
    bookings.value = []
    loading.value = false
    return
  }

  loading.value = true

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('cleaner_id', auth.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    alert('Failed to load bookings')
    bookings.value = []
    loading.value = false
    return
  }

  bookings.value = data || []
  loading.value = false
}

async function acceptBooking(id: string) {
  const { error } = await supabase.functions.invoke('accept-booking', {
    body: { booking_id: id },
  })

  if (error) {
    console.error(error)
    alert('Failed to accept booking')
    return
  }

  await loadBookings()
}

async function declineBooking(id: string) {
  const { error } = await supabase.from('bookings').update({ status: 'declined' }).eq('id', id)

  if (error) {
    console.error(error)
    alert('Failed to decline')
    return
  }

  await loadBookings()
}
</script>
