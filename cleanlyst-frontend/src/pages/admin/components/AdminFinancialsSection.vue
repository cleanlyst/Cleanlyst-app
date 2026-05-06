<template>
  <div class="bg-background text-on-background antialiased">
    <!-- Main -->
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <!-- Header -->
      <section class="space-y-2">
        <h1 class="font-h1 text-h1 text-primary">Financial Overview</h1>
        <p class="font-body text-body text-secondary">
          Monitor platform earnings, payout liabilities, and revenue growth metrics.
        </p>
      </section>

      <!-- Metrics -->
      <section class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary"> Total Revenue (YTD) </span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">$412,850.00</span>
            <span class="font-caption text-caption text-secondary">+12.5%</span>
          </div>
        </div>

        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary"> Net Profit </span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">$84,210.00</span>
            <span class="font-caption text-caption text-secondary">+8.2%</span>
          </div>
        </div>

        <div
          class="p-padding-card border border-outline-variant bg-surface-container-lowest flex flex-col gap-2"
        >
          <span class="font-label-md text-label-md text-secondary"> Pending Payouts </span>
          <div class="flex items-baseline gap-2">
            <span class="font-h1 text-h1 text-primary">$18,440.00</span>
            <span class="font-caption text-caption text-secondary"> 24 Cleaners </span>
          </div>
        </div>
      </section>

      <!-- Chart -->
      <section
        class="mb-4 border border-outline-variant bg-surface-container-lowest p-padding-card"
      >
        <div class="flex justify-between items-center mb-8">
          <h2 class="font-h2 text-h2 text-primary">Revenue Performance</h2>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 border border-outline-variant font-label-md text-caption bg-surface-container"
            >
              Monthly
            </button>
            <button class="px-3 py-1 border border-outline-variant font-label-md text-caption">
              Quarterly
            </button>
          </div>
        </div>

        <div class="h-[320px] w-full relative bg-surface-container-low flex items-end px-4 gap-4">
          <div class="flex-1 bg-primary-fixed-dim h-[40%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[55%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[45%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[70%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[65%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[85%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[75%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[90%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[80%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[95%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary-fixed-dim h-[88%] hover:bg-primary"></div>
          <div class="flex-1 bg-primary h-[100%]"></div>
        </div>

        <div class="flex justify-between mt-4 font-caption text-caption text-secondary">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span> <span>May</span
          ><span>Jun</span><span>Jul</span><span>Aug</span> <span>Sep</span><span>Oct</span
          ><span>Nov</span><span>Dec</span>
        </div>
      </section>

      <!-- Transactions -->
      <section class="space-y-4 mb-4">
        <h2 class="font-h2 text-h2 text-primary">Recent Transactions</h2>

        <div class="overflow-x-auto border border-outline-variant bg-surface-container-lowest">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant text-secondary">
                <th class="px-6 py-4 font-label-md text-label-md">Transaction ID</th>
                <th class="px-6 py-4 font-label-md text-label-md">Date</th>
                <th class="px-6 py-4 font-label-md text-label-md">Amount</th>
                <th class="px-6 py-4 font-label-md text-label-md">Type</th>
                <th class="px-6 py-4 font-label-md text-label-md">Status</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-outline-variant">
              <tr class="hover:bg-surface-container-low transition-colors">
                <td class="px-6 py-4 font-label-md text-body text-primary">#TRX-88219</td>
                <td class="px-6 py-4 font-body text-body text-secondary">Oct 24, 2024</td>
                <td class="px-6 py-4 font-label-md text-body text-primary">$120.00</td>
                <td class="px-6 py-4">
                  <span
                    class="px-2 py-1 bg-surface-container-high font-caption text-caption rounded"
                  >
                    Commission
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="flex items-center gap-1.5 font-caption text-caption text-secondary">
                    <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Complete
                  </span>
                </td>
              </tr>

              <tr class="hover:bg-surface-container-low transition-colors">
                <td class="px-6 py-4 font-label-md text-body text-primary">#TRX-88218</td>
                <td class="px-6 py-4 font-body text-body text-secondary">Oct 24, 2024</td>
                <td class="px-6 py-4 font-label-md text-body text-primary">$450.00</td>
                <td class="px-6 py-4">
                  <span
                    class="px-2 py-1 bg-surface-container-high font-caption text-caption rounded"
                  >
                    Payout
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="flex items-center gap-1.5 font-caption text-caption text-secondary">
                    <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Pending
                  </span>
                </td>
              </tr>

              <tr class="hover:bg-surface-container-low transition-colors">
                <td class="px-6 py-4 font-label-md text-body text-primary">#TRX-88217</td>
                <td class="px-6 py-4 font-body text-body text-secondary">Oct 23, 2024</td>
                <td class="px-6 py-4 font-label-md text-body text-primary">$15.00</td>
                <td class="px-6 py-4">
                  <span
                    class="px-2 py-1 bg-surface-container-high font-caption text-caption rounded"
                  >
                    Fee
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="flex items-center gap-1.5 font-caption text-caption text-error">
                    <span class="w-1.5 h-1.5 rounded-full bg-error"></span>
                    Canceled
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-center pt-4">
          <button
            class="font-label-md text-label-md text-primary px-6 py-3 border border-outline-variant hover:bg-surface-container transition-colors"
          >
            View All Transactions
          </button>
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
