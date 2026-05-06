<template>
  <div
    class="customer-onboarding-customer-page bg-background text-on-background antialiased font-body"
  >
    <main class="pt-24 pb-20 min-h-screen px-6 lg:px-12">
      <div class="max-w-4xl mx-auto">
        <!-- Step Indicator -->
        <div class="flex items-center justify-between mb-12">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
              <span
                class="material-symbols-outlined text-sm"
                style="font-variation-settings: 'FILL' 1"
                >check</span
              >
            </div>
            <div class="hidden sm:block">
              <p class="text-label-md font-label-md text-zinc-400">Account</p>
            </div>
          </div>
          <div class="h-[1px] flex-1 mx-4 bg-zinc-200"></div>
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center"
            >
              <span class="text-label-md font-bold">2</span>
            </div>
            <div>
              <p class="text-label-md font-label-md text-primary">Preferences</p>
            </div>
          </div>
          <div class="h-[1px] flex-1 mx-4 bg-zinc-200"></div>
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center"
            >
              <span class="text-label-md font-label-md text-zinc-400">3</span>
            </div>
            <div class="hidden sm:block">
              <p class="text-label-md font-label-md text-zinc-400">Schedule</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <!-- Left Column: Form -->
          <div class="lg:col-span-8 space-y-12">
            <section>
              <h1 class="font-h1 text-h1 mb-2">Service Preferences</h1>
              <p class="text-secondary text-body max-w-lg">
                Tell us about your property and specific requirements to help us find the perfect
                match for your home.
              </p>
            </section>
            <form class="space-y-10">
              <!-- Property Details Group -->
              <div class="space-y-6">
                <h2 class="font-h2 text-h2">Property Details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label class="block font-label-md text-label-md">Number of Bedrooms</label>
                    <div class="relative">
                      <select
                        class="w-full bg-white border border-zinc-200 p-3 rounded appearance-none focus:border-primary outline-none text-body"
                      >
                        <option>Studio / 1 Bedroom</option>
                        <option>2 Bedrooms</option>
                        <option>3 Bedrooms</option>
                        <option>4+ Bedrooms</option>
                      </select>
                      <span
                        class="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-zinc-400"
                        >expand_more</span
                      >
                    </div>
                  </div>
                  <div class="space-y-2">
                    <label class="block font-label-md text-label-md">Number of Bathrooms</label>
                    <div class="relative">
                      <select
                        class="w-full bg-white border border-zinc-200 p-3 rounded appearance-none focus:border-primary outline-none text-body"
                      >
                        <option>1 Bathroom</option>
                        <option>1.5 Bathrooms</option>
                        <option>2 Bathrooms</option>
                        <option>3+ Bathrooms</option>
                      </select>
                      <span
                        class="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-zinc-400"
                        >expand_more</span
                      >
                    </div>
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="block font-label-md text-label-md">Service Address</label>
                  <div class="relative">
                    <span class="material-symbols-outlined absolute left-3 top-3.5 text-zinc-400"
                      >location_on</span
                    >
                    <input
                      class="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded focus:border-primary outline-none text-body"
                      placeholder="Street Address, Apartment, Suite"
                      type="text"
                      value="1242 Minimalist Way, Apt 4B"
                    />
                  </div>
                </div>
              </div>
              <!-- Cleaner Preferences Group -->
              <div class="space-y-6">
                <h2 class="font-h2 text-h2">Cleaner Preferences</h2>
                <div class="grid grid-cols-1 gap-4">
                  <label
                    class="flex items-start gap-4 p-4 border border-zinc-200 rounded cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <input
                      checked
                      class="mt-1 w-5 h-5 rounded border-zinc-300 text-primary focus:ring-primary"
                      type="checkbox"
                    />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          class="material-symbols-outlined text-zinc-900"
                          style="font-variation-settings: 'FILL' 1"
                          >eco</span
                        >
                        <span class="font-label-md text-zinc-900">Eco-Friendly Supplies Only</span>
                      </div>
                      <p class="text-caption text-zinc-500">
                        Cleaner will use biodegradable, non-toxic cleaning agents.
                      </p>
                    </div>
                  </label>
                  <label
                    class="flex items-start gap-4 p-4 border border-zinc-200 rounded cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <input
                      checked
                      class="mt-1 w-5 h-5 rounded border-zinc-300 text-primary focus:ring-primary"
                      type="checkbox"
                    />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          class="material-symbols-outlined text-zinc-900"
                          style="font-variation-settings: 'FILL' 1"
                          >pets</span
                        >
                        <span class="font-label-md text-zinc-900">Pets are Okay</span>
                      </div>
                      <p class="text-caption text-zinc-500">
                        I have pets at home; cleaner must be comfortable around animals.
                      </p>
                    </div>
                  </label>
                  <label
                    class="flex items-start gap-4 p-4 border border-zinc-200 rounded cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <input
                      class="mt-1 w-5 h-5 rounded border-zinc-300 text-primary focus:ring-primary"
                      type="checkbox"
                    />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          class="material-symbols-outlined text-zinc-900"
                          style="font-variation-settings: 'FILL' 1"
                          >vacuum</span
                        >
                        <span class="font-label-md text-zinc-900">Provide Own Equipment</span>
                      </div>
                      <p class="text-caption text-zinc-500">
                        I do not have a vacuum or mop; cleaner must bring their own.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              <!-- Action Bar -->
              <div
                class="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-zinc-200"
              >
                <button
                  class="text-zinc-500 font-label-md hover:text-zinc-900 transition-colors"
                  type="button"
                >
                  Back to Account
                </button>
                <button
                  class="w-full sm:w-auto px-8 py-4 bg-primary text-white font-label-md hover:opacity-90 transition-opacity active:scale-[0.98]"
                  type="submit"
                >
                  Save &amp; Continue
                </button>
              </div>
            </form>
          </div>
          <!-- Right Column: Context/Visual -->
          <div class="lg:col-span-4 space-y-8">
            <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-xl space-y-6">
              <div class="w-full h-48 bg-zinc-200 rounded overflow-hidden">
                <img
                  class="w-full h-full object-cover grayscale opacity-80"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAn1EwVlku_xUGCu8uV7fSlg0eeMkCn5PcgCnxRWDL9zHq4ALywELxR08U4QCy-ECgJudpsENG5r1jRfdbuKCMglamJO8Y2zDrhK9uL77pcDcLowPP1kq2Xc6SX7lBVMvXNDCOaP1xODLF28-alUfMWGEJYPhuSKZcLpApPMRfTOLEiLYvdZWz6V12StgRom6Aw43z6jqY0D_ZKJ53rdbwYuNEraF12nQCmc9d3TvA608dnQnI0UT8wLd4OrZmysSZ9IZmzSGtoRA"
                />
              </div>
              <div class="space-y-4">
                <h3
                  class="font-label-md text-zinc-900 font-bold uppercase tracking-widest text-[10px]"
                >
                  Why details matter
                </h3>
                <div class="flex gap-4">
                  <span class="material-symbols-outlined text-zinc-400">verified_user</span>
                  <p class="text-caption text-zinc-600">
                    Accurate property details ensure we assign cleaners with the right equipment and
                    experience for your home's size.
                  </p>
                </div>
                <div class="flex gap-4">
                  <span class="material-symbols-outlined text-zinc-400">lock</span>
                  <p class="text-caption text-zinc-600">
                    Your address is only shared with verified professionals once a booking is
                    confirmed.
                  </p>
                </div>
              </div>
            </div>
            <div class="p-6 border border-zinc-200 rounded-xl">
              <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined text-zinc-900 text-[20px]">info</span>
                <span class="font-label-md text-zinc-900">Estimated Pricing</span>
              </div>
              <p class="text-body font-bold text-zinc-900 mb-1">$85.00 - $120.00</p>
              <p class="text-caption text-zinc-500">
                Based on a 2 bedroom apartment. Final price will be calculated after scheduling.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div
      class="fixed bottom-8 left-8 bg-zinc-900 text-white px-6 py-4 rounded shadow-lg flex items-center gap-4 z-[100]"
    >
      <p class="text-label-md">Account info saved successfully.</p>
      <button class="material-symbols-outlined text-zinc-400 hover:text-white transition-colors">
        close
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
.customer-onboarding-customer-page {
  font-family: 'Inter', sans-serif;
}
</style>
