<template>
  <div class="bg-background text-on-background antialiased">
    <main class="pt-8 pb-24 px-6 lg:px-12 max-w-5xl space-y-10">

      <!-- Header -->
      <section class="space-y-1">
        <h1 class="font-h1 text-h1 text-primary">Membership Management</h1>
        <p class="font-body text-body text-secondary">
          Manage membership plans and customer access to the Cleanlyst trusted network.
        </p>
      </section>

      <!-- Error banner -->
      <div
        v-if="error"
        class="p-4 border border-red-200 bg-red-50 text-red-700 text-sm"
      >{{ error }}</div>

      <!-- ── Membership Plans ──────────────────────────────────────────────── -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-h2 text-h2 text-primary">Membership Plans</h2>
          <button
            class="px-4 py-2 bg-primary text-white font-label-md text-sm"
            @click="openNewPlanModal"
          >
            + New Plan
          </button>
        </div>

        <div v-if="plansLoading" class="py-6 text-center text-secondary text-sm animate-pulse">
          Loading plans…
        </div>

        <div v-else-if="plans.length === 0" class="py-6 text-center text-secondary text-sm">
          No membership plans yet.
        </div>

        <div v-else class="border border-outline-variant divide-y divide-outline-variant">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="flex items-center justify-between px-5 py-4"
          >
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-label-md text-label-md text-primary">{{ plan.name }}</span>
                <span
                  :class="[
                    'text-xs px-2 py-0.5 font-medium',
                    plan.active
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-variant text-on-surface-variant',
                  ]"
                >{{ plan.active ? 'Active' : 'Inactive' }}</span>
              </div>
              <p class="text-caption text-secondary">
                £{{ (plan.price_pence / 100).toFixed(2) }} / {{ plan.billing_interval }}
                <span v-if="plan.stripe_price_id" class="ml-2 text-on-surface-variant">
                  · Stripe: {{ plan.stripe_price_id }}
                </span>
              </p>
              <p v-if="plan.description" class="text-caption text-on-surface-variant">
                {{ plan.description }}
              </p>
            </div>
            <button
              class="text-sm text-primary underline"
              @click="openEditPlanModal(plan)"
            >Edit</button>
          </div>
        </div>
      </section>

      <!-- ── Member List ────────────────────────────────────────────────────── -->
      <section class="space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <h2 class="font-h2 text-h2 text-primary">Members</h2>
          <div class="flex items-center gap-2">
            <label class="text-sm text-secondary">Filter:</label>
            <select
              v-model="memberFilter"
              class="border border-outline-variant px-3 py-1.5 text-sm bg-white focus:border-primary outline-none"
              @change="loadMembers"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="complimentary">Complimentary</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>

        <div v-if="membersLoading" class="py-6 text-center text-secondary text-sm animate-pulse">
          Loading members…
        </div>

        <div v-else-if="members.length === 0" class="py-6 text-center text-secondary text-sm">
          No members found.
        </div>

        <div v-else class="border border-outline-variant divide-y divide-outline-variant">
          <div
            v-for="member in members"
            :key="member.membership_id"
            class="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div class="space-y-0.5 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-label-md text-label-md text-primary truncate">
                  {{ member.customer_name ?? 'Unknown' }}
                </span>
                <span
                  :class="[
                    'text-xs px-2 py-0.5 font-medium flex-shrink-0',
                    statusChipClass(member.status),
                  ]"
                >{{ member.status }}</span>
              </div>
              <p class="text-caption text-secondary truncate">{{ member.customer_email }}</p>
              <p v-if="member.plan_name" class="text-caption text-on-surface-variant">
                Plan: {{ member.plan_name }}
              </p>
              <p v-if="member.current_period_end" class="text-caption text-on-surface-variant">
                Expires: {{ formatDate(member.current_period_end) }}
              </p>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                v-if="member.status === 'free' || member.status === 'cancelled'"
                class="text-xs px-3 py-1.5 bg-secondary-container text-on-secondary-container font-medium"
                :disabled="actionLoading === member.customer_id"
                @click="grantMembership(member.customer_id)"
              >
                Grant
              </button>
              <button
                v-if="member.status === 'active' || member.status === 'complimentary'"
                class="text-xs px-3 py-1.5 border border-outline-variant text-secondary font-medium"
                :disabled="actionLoading === member.customer_id"
                @click="pauseMembership(member.customer_id)"
              >
                Pause
              </button>
              <button
                v-if="member.status === 'paused'"
                class="text-xs px-3 py-1.5 bg-secondary-container text-on-secondary-container font-medium"
                :disabled="actionLoading === member.customer_id"
                @click="reactivateMembership(member.customer_id)"
              >
                Reactivate
              </button>
              <button
                v-if="member.status !== 'cancelled' && member.status !== 'free'"
                class="text-xs px-3 py-1.5 bg-error-container text-on-error-container font-medium"
                :disabled="actionLoading === member.customer_id"
                @click="cancelMembership(member.customer_id)"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Grant by email -->
        <div class="border border-outline-variant p-5 space-y-3 bg-surface-container-lowest">
          <h3 class="font-label-md text-label-md text-primary">Grant Complimentary Membership</h3>
          <p class="text-caption text-secondary">
            Enter a customer's user ID to grant them complimentary access.
          </p>
          <div class="flex gap-2 flex-wrap">
            <input
              v-model="grantCustomerId"
              type="text"
              placeholder="Customer user ID (UUID)"
              class="flex-1 min-w-48 border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
            />
            <input
              v-model="grantReason"
              type="text"
              placeholder="Reason (optional)"
              class="flex-1 min-w-48 border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
            />
            <button
              class="px-4 py-2 bg-primary text-white text-sm font-label-md"
              :disabled="!grantCustomerId.trim() || grantLoading"
              @click="grantByIdInput"
            >
              {{ grantLoading ? 'Granting…' : 'Grant' }}
            </button>
          </div>
          <p v-if="grantSuccess" class="text-caption text-green-700">{{ grantSuccess }}</p>
          <p v-if="grantError" class="text-caption text-red-600">{{ grantError }}</p>
        </div>
      </section>

    </main>
  </div>

  <!-- ── Plan modal ──────────────────────────────────────────────────────────── -->
  <div
    v-if="planModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="closePlanModal"
  >
    <div class="bg-white w-full max-w-md mx-4 p-6 space-y-5">
      <h3 class="font-h2 text-h2 text-primary">
        {{ editingPlan ? 'Edit Plan' : 'New Plan' }}
      </h3>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-primary mb-1">Plan Name *</label>
          <input
            v-model="planForm.name"
            type="text"
            class="w-full border border-outline-variant px-3 py-2 focus:border-primary outline-none"
            placeholder="e.g. Cleanlyst Member"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-primary mb-1">Description</label>
          <textarea
            v-model="planForm.description"
            rows="2"
            class="w-full border border-outline-variant px-3 py-2 focus:border-primary outline-none resize-none"
            placeholder="What members get…"
          ></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-primary mb-1">Price (pence) *</label>
            <input
              v-model.number="planForm.pricePence"
              type="number"
              min="0"
              step="1"
              class="w-full border border-outline-variant px-3 py-2 focus:border-primary outline-none"
              placeholder="999"
            />
            <p class="text-xs text-secondary mt-0.5">
              = £{{ planForm.pricePence ? (planForm.pricePence / 100).toFixed(2) : '0.00' }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1">Billing</label>
            <select
              v-model="planForm.billingInterval"
              class="w-full border border-outline-variant px-3 py-2 focus:border-primary outline-none bg-white"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-primary mb-1">Stripe Price ID</label>
          <input
            v-model="planForm.stripePriceId"
            type="text"
            class="w-full border border-outline-variant px-3 py-2 focus:border-primary outline-none"
            placeholder="price_…"
          />
        </div>
        <div class="flex items-center gap-2">
          <input
            id="plan-active"
            v-model="planForm.active"
            type="checkbox"
            class="w-4 h-4 accent-primary"
          />
          <label for="plan-active" class="text-sm text-primary">Active (visible to customers)</label>
        </div>
      </div>

      <p v-if="planModalError" class="text-sm text-red-600">{{ planModalError }}</p>

      <div class="flex gap-3 pt-2">
        <button
          class="flex-1 py-2 border border-outline-variant text-primary font-label-md"
          @click="closePlanModal"
        >Cancel</button>
        <button
          class="flex-1 py-2 bg-primary text-white font-label-md"
          :disabled="planSaving || !planForm.name || !planForm.pricePence"
          @click="savePlan"
        >
          {{ planSaving ? 'Saving…' : 'Save Plan' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  adminListMembers,
  adminGrantMembership,
  adminCancelMembership,
  adminPauseMembership,
  adminReactivateMembership,
  adminGetAllPlans,
  adminUpsertMembershipPlan,
  type AdminMemberRow,
} from '@/services/membershipService'
import type { MembershipPlan, MembershipStatus } from '@cleanlyst-backend/types/database.types'

// ── State ────────────────────────────────────────────────────────────────────

const error         = ref('')
const plans         = ref<MembershipPlan[]>([])
const plansLoading  = ref(true)
const members       = ref<AdminMemberRow[]>([])
const membersLoading = ref(true)
const memberFilter  = ref<string>('')
const actionLoading = ref<string | null>(null)

const grantCustomerId = ref('')
const grantReason     = ref('')
const grantLoading    = ref(false)
const grantSuccess    = ref('')
const grantError      = ref('')

// Plan modal
const planModalOpen  = ref(false)
const planSaving     = ref(false)
const planModalError = ref('')
const editingPlan    = ref<MembershipPlan | null>(null)
const planForm       = ref({
  name:            '',
  description:     '',
  pricePence:      999,
  billingInterval: 'monthly' as 'monthly' | 'annual',
  stripePriceId:   '',
  active:          true,
})

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadPlans(), loadMembers()])
})

// ── Loaders ──────────────────────────────────────────────────────────────────

async function loadPlans() {
  plansLoading.value = true
  try {
    plans.value = await adminGetAllPlans()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load plans'
  } finally {
    plansLoading.value = false
  }
}

async function loadMembers() {
  membersLoading.value = true
  try {
    const status = memberFilter.value as MembershipStatus | ''
    members.value = await adminListMembers(status || null)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load members'
  } finally {
    membersLoading.value = false
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function grantMembership(customerId: string) {
  actionLoading.value = customerId
  try {
    await adminGrantMembership(customerId, plans.value[0]?.id ?? null, 'Admin grant')
    await loadMembers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to grant membership'
  } finally {
    actionLoading.value = null
  }
}

async function pauseMembership(customerId: string) {
  actionLoading.value = customerId
  try {
    await adminPauseMembership(customerId)
    await loadMembers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to pause membership'
  } finally {
    actionLoading.value = null
  }
}

async function reactivateMembership(customerId: string) {
  actionLoading.value = customerId
  try {
    await adminReactivateMembership(customerId)
    await loadMembers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to reactivate membership'
  } finally {
    actionLoading.value = null
  }
}

async function cancelMembership(customerId: string) {
  if (!confirm('Cancel this membership? The customer will lose access immediately.')) return
  actionLoading.value = customerId
  try {
    await adminCancelMembership(customerId)
    await loadMembers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to cancel membership'
  } finally {
    actionLoading.value = null
  }
}

async function grantByIdInput() {
  grantSuccess.value = ''
  grantError.value = ''
  grantLoading.value = true
  try {
    await adminGrantMembership(
      grantCustomerId.value.trim(),
      plans.value[0]?.id ?? null,
      grantReason.value.trim() || 'Admin grant',
    )
    grantSuccess.value = 'Complimentary membership granted.'
    grantCustomerId.value = ''
    grantReason.value = ''
    await loadMembers()
  } catch (e) {
    grantError.value = e instanceof Error ? e.message : 'Failed to grant membership'
  } finally {
    grantLoading.value = false
  }
}

// ── Plan modal ────────────────────────────────────────────────────────────────

function openNewPlanModal() {
  editingPlan.value = null
  planForm.value = {
    name: '',
    description: '',
    pricePence: 999,
    billingInterval: 'monthly',
    stripePriceId: '',
    active: true,
  }
  planModalError.value = ''
  planModalOpen.value = true
}

function openEditPlanModal(plan: MembershipPlan) {
  editingPlan.value = plan
  planForm.value = {
    name:            plan.name,
    description:     plan.description ?? '',
    pricePence:      plan.price_pence,
    billingInterval: plan.billing_interval,
    stripePriceId:   plan.stripe_price_id ?? '',
    active:          plan.active,
  }
  planModalError.value = ''
  planModalOpen.value = true
}

function closePlanModal() {
  planModalOpen.value = false
}

async function savePlan() {
  planModalError.value = ''
  planSaving.value = true
  try {
    await adminUpsertMembershipPlan({
      id:              editingPlan.value?.id ?? null,
      name:            planForm.value.name,
      description:     planForm.value.description || null,
      pricePence:      planForm.value.pricePence,
      billingInterval: planForm.value.billingInterval,
      stripePriceId:   planForm.value.stripePriceId || null,
      active:          planForm.value.active,
    })
    await loadPlans()
    closePlanModal()
  } catch (e) {
    planModalError.value = e instanceof Error ? e.message : 'Failed to save plan'
  } finally {
    planSaving.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusChipClass(status: MembershipStatus): string {
  const map: Record<MembershipStatus, string> = {
    active:         'bg-secondary-container text-on-secondary-container',
    complimentary:  'bg-primary-container text-on-primary-container',
    paused:         'bg-tertiary-container text-on-tertiary-container',
    cancelled:      'bg-error-container text-on-error-container',
    free:           'bg-surface-variant text-on-surface-variant',
  }
  return map[status] ?? 'bg-surface-variant text-on-surface-variant'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
