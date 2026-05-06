<template>
  <div class="bg-background text-on-surface antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <!-- Header -->
      <header class="mb-12">
        <h1 class="font-h1 text-h1 text-on-surface mb-2">Pending Cleaner Applications</h1>
        <p class="font-body text-body text-on-surface-variant max-w-2xl">
          Review and manage onboarding applications for new service providers. Background checks and
          identity verification are prioritized.
        </p>
      </header>

      <!-- Search + Filters -->
      <section class="mb-8 flex flex-col md:flex-row gap-stack-gap items-center justify-between">
        <div class="relative w-full md:w-96">
          <span
            class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            >search</span
          >
          <input
            class="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
            placeholder="Search by name, email, or city..."
            type="text"
          />
        </div>

        <div class="flex gap-2 w-full md:w-auto">
          <button
            class="flex items-center gap-2 px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">filter_list</span>
            Filter
          </button>

          <button
            class="flex items-center gap-2 px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">sort</span>
            Latest First
          </button>
        </div>
      </section>

      <!-- Table -->
      <div
        class="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
      >
        <table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low border-b border-outline-variant">
            <tr>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Cleaner Profile
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Location & Date
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Specialisations
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Verification Status
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-outline-variant">
            <!-- Row -->
            <tr class="hover:bg-surface-container-low transition-colors">
              <td class="px-6 py-6">
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant"
                  >
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIItl1G86Hb4a_z1tE2wNBHZZ4n6GRHCVaw_jm7bpKjT9D1TF3DsUMjO5HKMaahJgO_tRiJ2E7MnaY74ZJ7GE9EwrP0HIovtDFpmUteIEUXIx0Qatj2rrY39Z9ygfVWW5v3eV-p_8lrUAA0Dcx-3_x23fQwo2kRAhBx3sLF9VrAZR_l8qHmEX4DpXVhVIohrPE9mgd4DHzsCv6tdidxvN8wS6wLU0vbKVpJlTC3xKa7QTQy5aBbuIs3pUBaniRC17YUZYkdlpauw"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div class="font-body text-body text-on-surface">Sarah Miller</div>
                    <div class="font-caption text-caption text-on-surface-variant">
                      sarah.miller@example.com
                    </div>
                  </div>
                </div>
              </td>

              <td class="px-6 py-6">
                <div class="font-body text-body text-on-surface">Didsbury, Manchester</div>
                <div class="font-caption text-caption text-on-surface-variant">
                  Applied: Oct 12, 2024
                </div>
              </td>

              <td class="px-6 py-6">
                <div class="flex flex-wrap gap-1">
                  <span
                    class="px-2 py-0.5 bg-surface-container-high text-caption font-label-md text-on-surface rounded"
                    >Deep Clean</span
                  >
                  <span
                    class="px-2 py-0.5 bg-surface-container-high text-caption font-label-md text-on-surface rounded"
                    >Eco-Friendly</span
                  >
                </div>
              </td>

              <td class="px-6 py-6">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-secondary"></span>
                  <span class="font-caption text-caption text-on-surface">
                    Awaiting ID Verification
                  </span>
                </div>
              </td>

              <td class="px-6 py-6 text-right">
                <button
                  class="px-3 py-1.5 font-label-md text-on-surface bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-variant transition-colors"
                >
                  Review Application
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          class="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between"
        >
          <span class="font-caption text-caption text-on-surface-variant">
            Showing 4 of 127 applications
          </span>

          <div class="flex gap-2">
            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              disabled
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>

            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Insights -->
      <section class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Pending Total</div>
          <div class="font-h1 text-h1 text-on-surface">127</div>
        </div>

        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Avg. Review Time</div>
          <div class="font-h1 text-h1 text-on-surface">1.4 Days</div>
        </div>

        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Priority Reviews</div>
          <div class="font-h1 text-h1 text-on-surface">08</div>
        </div>
      </section>
    </main>
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
</style>
