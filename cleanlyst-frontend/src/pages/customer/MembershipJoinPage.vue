<template>
  <div class="min-h-screen bg-background text-on-background antialiased font-body pt-20 pb-24">
    <div class="max-w-2xl mx-auto px-6 space-y-10">

      <!-- Hero -->
      <section class="text-center space-y-4">
        <span class="material-symbols-outlined text-5xl text-primary">verified_user</span>
        <h1 class="font-h1 text-h1 text-primary">Become a Cleanlyst Member</h1>
        <p class="font-body text-body text-secondary max-w-lg mx-auto">
          Access our trusted network of fully vetted, background-checked cleaners.
          Every cleaner on Cleanlyst passes our rigorous vetting process —
          so you can book with complete peace of mind.
        </p>
      </section>

      <!-- What you get -->
      <section class="bg-surface-container-lowest border border-outline-variant p-6 space-y-4">
        <h2 class="font-h2 text-h2 text-primary">What members get</h2>
        <ul class="space-y-3">
          <li
            v-for="benefit in MEMBER_BENEFITS"
            :key="benefit.text"
            class="flex items-start gap-3"
          >
            <span class="material-symbols-outlined text-secondary-container text-xl mt-0.5 flex-shrink-0">
              {{ benefit.icon }}
            </span>
            <span class="font-body text-body text-on-background">{{ benefit.text }}</span>
          </li>
        </ul>
      </section>

      <!-- Plans -->
      <section v-if="plans.length > 0" class="space-y-4">
        <h2 class="font-h2 text-h2 text-primary">Choose your plan</h2>
        <div class="space-y-3">
          <div
            v-for="plan in plans"
            :key="plan.id"
            :class="[
              'border-2 p-5 cursor-pointer transition-colors',
              selectedPlanId === plan.id
                ? 'border-primary bg-surface-variant'
                : 'border-outline-variant hover:border-primary',
            ]"
            @click="selectedPlanId = plan.id"
          >
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="font-label-md text-label-md text-primary">{{ plan.name }}</p>
                <p v-if="plan.description" class="text-caption text-secondary">{{ plan.description }}</p>
              </div>
              <div class="text-right">
                <p class="font-h2 text-h2 text-primary">£{{ (plan.price_pence / 100).toFixed(2) }}</p>
                <p class="text-caption text-secondary">per {{ plan.billing_interval }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Free tier comparison -->
      <section class="border border-outline-variant divide-y divide-outline-variant">
        <div class="px-5 py-3 bg-surface-container">
          <div class="grid grid-cols-3 gap-2 text-sm font-medium text-secondary">
            <span>Feature</span>
            <span class="text-center">Free</span>
            <span class="text-center text-primary">Member</span>
          </div>
        </div>
        <div
          v-for="row in COMPARISON_ROWS"
          :key="row.feature"
          class="px-5 py-3 grid grid-cols-3 gap-2 items-center text-sm"
        >
          <span class="text-on-background">{{ row.feature }}</span>
          <span class="text-center">
            <span
              :class="row.free
                ? 'material-symbols-outlined text-secondary-container text-base'
                : 'material-symbols-outlined text-outline-variant text-base'"
            >{{ row.free ? 'check_circle' : 'cancel' }}</span>
          </span>
          <span class="text-center">
            <span class="material-symbols-outlined text-primary text-base">check_circle</span>
          </span>
        </div>
      </section>

      <!-- CTA -->
      <section class="space-y-3 text-center">
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          class="w-full py-4 bg-primary text-white font-label-md text-base"
          :disabled="loading || plans.length === 0"
          @click="startMembership"
        >
          <span v-if="loading" class="flex items-center justify-center gap-2">
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Starting membership…
          </span>
          <span v-else>Start my membership →</span>
        </button>

        <p class="text-caption text-secondary">
          Cancel anytime. Membership is billed {{ activePlan?.billing_interval ?? 'monthly' }}.
        </p>

        <router-link :to="{ name: 'CustomerDashboard' }" class="block text-sm text-primary underline">
          Back to dashboard
        </router-link>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getMembershipPlans } from '@/services/membershipService'
import { toUserMessage } from '@/utils/format'
import type { MembershipPlan } from '@/types/database.types'

const MEMBER_BENEFITS = [
  { icon: 'search',       text: 'View full cleaner profiles, photos, and bios' },
  { icon: 'star',         text: 'Read verified member reviews' },
  { icon: 'calendar_month', text: 'See cleaner availability and book instantly' },
  { icon: 'repeat',       text: 'Set up recurring cleaning schedules' },
  { icon: 'favorite',     text: 'Save favourite cleaners' },
  { icon: 'history',      text: 'Full booking history and receipts' },
  { icon: 'support_agent', text: 'Priority member support' },
  { icon: 'verified_user', text: 'Peace of mind — every cleaner is fully vetted' },
]

const COMPARISON_ROWS = [
  { feature: 'Browse cleaners',          free: true },
  { feature: 'View approximate pricing', free: true },
  { feature: 'See overall rating',       free: true },
  { feature: '"Verified by Cleanlyst" badge', free: true },
  { feature: 'Full cleaner profiles',    free: false },
  { feature: 'Read reviews',             free: false },
  { feature: 'View availability',        free: false },
  { feature: 'Book cleaners',            free: false },
  { feature: 'Recurring bookings',       free: false },
  { feature: 'Save favourites',          free: false },
  { feature: 'Priority support',         free: false },
]

const plans         = ref<MembershipPlan[]>([])
const selectedPlanId = ref<string | null>(null)
const loading       = ref(false)
const error         = ref('')

const activePlan = computed(() =>
  plans.value.find(p => p.id === selectedPlanId.value) ?? plans.value[0] ?? null,
)

onMounted(async () => {
  try {
    plans.value = await getMembershipPlans()
    const [firstPlan] = plans.value
    if (firstPlan) {
      selectedPlanId.value = firstPlan.id
    }
  } catch (e) {
    error.value = toUserMessage(e, 'Failed to load plans')
  }
})

async function startMembership() {
  // Phase M2: wire to Stripe subscription checkout
  // For now, redirect to contact/support with intent to join
  loading.value = true
  error.value = ''
  try {
    // Placeholder: when Stripe subscription billing is wired up this will
    // call createMembershipCheckoutSession(selectedPlanId.value) and redirect
    // to Stripe. Until then, show a holding message.
    await new Promise(r => setTimeout(r, 400))
    error.value = 'Online membership sign-up is coming soon. Contact us at hello@cleanlyst.co.uk to join.'
  } finally {
    loading.value = false
  }
}
</script>
