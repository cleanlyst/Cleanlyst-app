<template>
  <main class="flex-grow lg:ml-64 p-6 lg:p-12">
    <div class="max-w-6xl mx-auto">
      <header class="mb-12">
        <h1 class="font-h1 text-h1 text-on-background mb-2">Admin Dashboard</h1>
        <p class="text-secondary">Overview of marketplace performance and operations.</p>
      </header>
      <!-- High-level Stats: Bento Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary" data-icon="group">group</span>
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">ACTIVE</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">1,248</h2>
          <p class="text-label-md font-label-md text-secondary">Active Cleaners</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm" data-icon="trending_up"
              >trending_up</span
            >
            <span class="text-caption font-caption">12% increase this month</span>
          </div>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary" data-icon="calendar_today"
              >calendar_today</span
            >
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">YTD</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">8,642</h2>
          <p class="text-label-md font-label-md text-secondary">Total Bookings</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm" data-icon="trending_up"
              >trending_up</span
            >
            <span class="text-caption font-caption">8% increase this week</span>
          </div>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary" data-icon="payments"
              >payments</span
            >
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">GROSS</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">$412,900</h2>
          <p class="text-label-md font-label-md text-secondary">Total Revenue</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm" data-icon="trending_up"
              >trending_up</span
            >
            <span class="text-caption font-caption">5.2% above target</span>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <!-- Pending Cleaner Approvals -->
        <section class="lg:col-span-8">
          <div class="bg-surface-container-lowest border border-outline-variant">
            <div class="p-6 border-b border-outline-variant flex justify-between items-center">
              <h2 class="font-label-md text-label-md uppercase tracking-widest text-primary">
                Pending Cleaner Approvals
              </h2>
              <button class="text-caption font-caption underline">View All</button>
            </div>
            <div class="divide-y divide-outline-variant">
              <!-- Pending Item 1 -->
              <div
                class="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-surface-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary" data-icon="person"
                      >person</span
                    >
                  </div>
                  <div>
                    <h3 class="font-label-md text-label-md text-on-background">Elena Rodriguez</h3>
                    <p class="text-caption text-secondary">Applied: 2 hours ago • New York, NY</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto">
                  <button
                    class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors"
                  >
                    Details
                  </button>
                  <button
                    class="flex-1 md:flex-none px-4 py-2 bg-primary text-on-primary text-label-md font-label-md hover:opacity-90 transition-opacity"
                  >
                    Approve
                  </button>
                </div>
              </div>
              <!-- Pending Item 2 -->
              <div
                class="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-surface-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary" data-icon="person"
                      >person</span
                    >
                  </div>
                  <div>
                    <h3 class="font-label-md text-label-md text-on-background">Marcus Chen</h3>
                    <p class="text-caption text-secondary">Applied: 5 hours ago • Seattle, WA</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto">
                  <button
                    class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors"
                  >
                    Details
                  </button>
                  <button
                    class="flex-1 md:flex-none px-4 py-2 bg-primary text-on-primary text-label-md font-label-md hover:opacity-90 transition-opacity"
                  >
                    Approve
                  </button>
                </div>
              </div>
              <!-- Pending Item 3 -->
              <div
                class="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-surface-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary" data-icon="person"
                      >person</span
                    >
                  </div>
                  <div>
                    <h3 class="font-label-md text-label-md text-on-background">Sarah J. Miller</h3>
                    <p class="text-caption text-secondary">Applied: Yesterday • Austin, TX</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto">
                  <button
                    class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors"
                  >
                    Details
                  </button>
                  <button
                    class="flex-1 md:flex-none px-4 py-2 bg-primary text-on-primary text-label-md font-label-md hover:opacity-90 transition-opacity"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <!-- Recent Activity -->
        <section class="lg:col-span-4">
          <div class="bg-surface-container-lowest border border-outline-variant h-full">
            <div class="p-6 border-b border-outline-variant">
              <h2 class="font-label-md text-label-md uppercase tracking-widest text-primary">
                Recent Activity
              </h2>
            </div>
            <div class="p-6 space-y-6">
              <!-- Activity 1 -->
              <div class="flex gap-4">
                <div class="relative">
                  <div class="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div class="absolute top-4 left-1 w-px h-full bg-outline-variant"></div>
                </div>
                <div>
                  <p class="text-label-md font-label-md">Payout Processed</p>
                  <p class="text-caption text-secondary">
                    Batch #2048 ($12,400) sent to processing bank.
                  </p>
                  <p class="text-[10px] text-outline mt-1 uppercase font-bold tracking-tighter">
                    10:45 AM
                  </p>
                </div>
              </div>
              <!-- Activity 2 -->
              <div class="flex gap-4">
                <div class="relative">
                  <div class="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div class="absolute top-4 left-1 w-px h-full bg-outline-variant"></div>
                </div>
                <div>
                  <p class="text-label-md font-label-md">New Conflict Reported</p>
                  <p class="text-caption text-secondary">
                    Booking #A-881 marked for manual review by support.
                  </p>
                  <p class="text-[10px] text-outline mt-1 uppercase font-bold tracking-tighter">
                    09:12 AM
                  </p>
                </div>
              </div>
              <!-- Activity 3 -->
              <div class="flex gap-4">
                <div class="relative">
                  <div class="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div class="absolute top-4 left-1 w-px h-full bg-outline-variant"></div>
                </div>
                <div>
                  <p class="text-label-md font-label-md">System Backup</p>
                  <p class="text-caption text-secondary">
                    Daily database integrity check completed successfully.
                  </p>
                  <p class="text-[10px] text-outline mt-1 uppercase font-bold tracking-tighter">
                    04:00 AM
                  </p>
                </div>
              </div>
              <!-- Activity 4 -->
              <div class="flex gap-4">
                <div class="relative">
                  <div class="w-2 h-2 rounded-full bg-primary mt-2"></div>
                </div>
                <div>
                  <p class="text-label-md font-label-md">Marketplace Cap Updated</p>
                  <p class="text-caption text-secondary">
                    Regional cleaner limits adjusted for California market.
                  </p>
                  <p class="text-[10px] text-outline mt-1 uppercase font-bold tracking-tighter">
                    Yesterday
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<script lang="ts" setup></script>

<style scoped>
.overview-container {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
}

.overview-icons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  margin-bottom: 10px;
}
</style>
