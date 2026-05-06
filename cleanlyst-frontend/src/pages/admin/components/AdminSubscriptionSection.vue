<template>
  <div class="fees-settings-admin-page bg-background text-on-surface antialiased">
    <!-- TopNavBar -->

    <main class="pt-32 pb-24 px-6 lg:px-12 max-w-7xl mx-auto">
      <!-- Asymmetric Bento Grid for Settings -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <!-- Primary Configuration: Subscription Fees -->
        <section
          class="md:col-span-8 bg-surface-container-lowest border border-outline-variant p-padding-card rounded-lg"
        >
          <div class="flex items-center gap-2 mb-8">
            <span class="material-symbols-outlined text-primary">payments</span>
            <h2 class="font-h2 text-h2">Cleaner Subscription Fees</h2>
          </div>
          <div class="space-y-stack-gap">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-stack-gap">
              <div class="space-y-2">
                <label class="font-label-md text-label-md text-on-surface-variant block"
                  >Monthly Tier ($)</label
                >
                <input
                  class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                  type="number"
                  value="29.00"
                />
              </div>
              <div class="space-y-2">
                <label class="font-label-md text-label-md text-on-surface-variant block"
                  >Annual Tier ($)</label
                >
                <input
                  class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                  type="number"
                  value="290.00"
                />
              </div>
            </div>
            <div class="pt-4 border-t border-surface-variant">
              <div class="flex items-center justify-between py-4">
                <div>
                  <h3 class="font-label-md text-label-md text-on-surface">Enable Free Trial</h3>
                  <p class="font-caption text-caption text-secondary">
                    New cleaners get 14 days free access.
                  </p>
                </div>
                <div class="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                  <div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <!-- Secondary Configuration: Platform Commission -->
        <section
          class="md:col-span-4 bg-surface-container-lowest border border-outline-variant p-padding-card rounded-lg flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center gap-2 mb-6">
              <span class="material-symbols-outlined text-primary">percent</span>
              <h2 class="font-h2 text-h2">Commission</h2>
            </div>
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="font-label-md text-label-md text-on-surface-variant block"
                  >Booking Fee (%)</label
                >
                <input
                  class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                  step="0.1"
                  type="number"
                  value="5.5"
                />
              </div>
              <p class="font-caption text-caption text-secondary leading-relaxed">
                This percentage is deducted from every successful booking made through the platform.
              </p>
            </div>
          </div>
          <button
            class="w-full h-12 mt-8 bg-surface-container-high border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant transition-colors"
          >
            Preview Revenue Calc
          </button>
        </section>
        <!-- Advanced Control: Tonal Layer Card -->
        <section class="md:col-span-4 bg-surface-variant p-padding-card rounded-lg">
          <h3 class="font-h2 text-h2 mb-4">Payout Schedule</h3>
          <p class="font-body text-body mb-6">
            Define the frequency of automated payouts to cleaner bank accounts.
          </p>
          <div class="space-y-3">
            <label
              class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded cursor-pointer"
            >
              <input
                checked=""
                class="text-primary focus:ring-primary"
                name="payout"
                type="radio"
              />
              <span class="font-label-md text-label-md">Daily</span>
            </label>
            <label
              class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded cursor-pointer"
            >
              <input class="text-primary focus:ring-primary" name="payout" type="radio" />
              <span class="font-label-md text-label-md">Weekly (Mon)</span>
            </label>
            <label
              class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant rounded cursor-pointer"
            >
              <input class="text-primary focus:ring-primary" name="payout" type="radio" />
              <span class="font-label-md text-label-md">Monthly (1st)</span>
            </label>
          </div>
        </section>
        <!-- System Limits: Form Inputs -->
        <section
          class="md:col-span-8 bg-surface-container-lowest border border-outline-variant p-padding-card rounded-lg"
        >
          <h3 class="font-h2 text-h2 mb-8">System Thresholds</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-stack-gap">
            <div class="space-y-2">
              <label class="font-label-md text-label-md text-on-surface-variant block"
                >Min Booking ($)</label
              >
              <input
                class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                type="number"
                value="25"
              />
            </div>
            <div class="space-y-2">
              <label class="font-label-md text-label-md text-on-surface-variant block"
                >Cancellation Window (hr)</label
              >
              <input
                class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                type="number"
                value="24"
              />
            </div>
            <div class="space-y-2">
              <label class="font-label-md text-label-md text-on-surface-variant block"
                >Platform Fee Cap ($)</label
              >
              <input
                class="w-full h-12 border border-outline-variant rounded px-4 focus:border-primary focus:ring-0 font-body text-body"
                type="number"
                value="15"
              />
            </div>
          </div>
        </section>
      </div>
      <div class="mt-12 flex justify-end gap-4 border-t border-surface-variant pt-12">
        <button
          class="px-8 py-3 bg-surface-container-lowest border border-outline-variant text-on-surface font-label-md rounded hover:bg-surface-variant transition-colors"
        >
          Discard Changes
        </button>
        <button
          class="px-12 py-3 bg-primary text-on-primary font-label-md rounded active:scale-95 transition-transform"
        >
          Save Global Settings
        </button>
      </div>
    </main>
    <!-- Visual Anchor Section -->
    <section class="py-24 bg-surface-dim">
      <div
        class="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-2 gap-16 items-center"
      >
        <div>
          <h2 class="font-h1 text-h1 text-on-surface mb-6">Transparency First</h2>
          <p class="font-body text-body text-secondary mb-8 leading-relaxed">
            Our platform logic is built on structural clarity. Adjusting these fees updates all
            marketplace calculations in real-time, ensuring a consistent experience for both
            cleaners and customers. We prioritize a sustainable ecosystem over aggressive scaling.
          </p>
          <div class="flex gap-4">
            <div class="flex flex-col">
              <span class="text-h1 font-h1 text-primary">12.5k</span>
              <span
                class="font-caption text-caption text-on-surface-variant uppercase tracking-wider"
                >Active Cleaners</span
              >
            </div>
            <div class="w-px h-12 bg-outline-variant"></div>
            <div class="flex flex-col">
              <span class="text-h1 font-h1 text-primary">$2.4M</span>
              <span
                class="font-caption text-caption text-on-surface-variant uppercase tracking-wider"
                >Monthly Volume</span
              >
            </div>
          </div>
        </div>
        <div class="relative aspect-video rounded-xl overflow-hidden border border-outline-variant">
          <img
            class="w-full h-full object-cover"
            data-alt="A minimalist architectural shot of a clean, modern office space with large windows and sharp geometric shadows. The interior features a palette of cool grays, deep blacks, and crisp whites, embodying the functional minimalism of a high-end marketplace platform. Natural soft daylight illuminates the space, creating a professional and orderly atmosphere."
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBujJ0DuoKe1e11Sn61QtQsuTcVr5XWmCi8PJQvc8KBImXIDfym6z7Q9Po2Rf-R8x14LuGvZa5rCwrh6Tz2DDCttkorWrjZAx5cAF_fnLRPlGQBZQ8-E5udAObj2HAWjXFGc7Paa5u48iRLD5oDvdrqWSS9mbt1O9rX_cNEcT5howAMHmvdMxT3YWTeN8tTuoKSrx4a0-E-5izSkotU1VpWRONRTV8uR96ijKCl3QVRgaWNMiTmgSsVgYRhe4kngKUHFDJKku9sog"
          />
        </div>
      </div>
    </section>
    <!-- Footer -->

    <!-- Global Toast Mockup -->
    <div
      class="fixed bottom-8 left-8 bg-primary text-on-primary p-4 rounded flex items-center gap-4 shadow-lg z-50"
    >
      <span class="material-symbols-outlined text-sm">info</span>
      <span class="font-label-md text-label-md">Unsaved changes in Platform Fees.</span>
      <button class="ml-2 hover:opacity-70 transition-opacity">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup></script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
.fees-settings-admin-page {
  font-family: 'Inter', sans-serif;
}
</style>
