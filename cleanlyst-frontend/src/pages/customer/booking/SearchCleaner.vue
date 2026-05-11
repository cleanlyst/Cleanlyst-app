<template>
  <main class="pt-24 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row gap-gutter">
      <!-- Left Sidebar Filters -->
      <aside class="w-full lg:w-72 shrink-0">
        <div class="sticky top-24 space-y-8">
          <div>
            <h2 class="font-h2 text-h2 mb-4">Filters</h2>
            <div class="h-px bg-outline-variant w-full mb-6"></div>
          </div>
          <!-- Service Filter -->
          <div class="space-y-4">
            <span
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >Service Type</span
            >
            <div class="flex flex-col gap-3">
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  checked
                  class="w-5 h-5 border-outline rounded bg-surface focus:ring-0 text-primary"
                  type="checkbox"
                />
                <span class="font-body text-body group-hover:text-primary transition-colors"
                  >Residential Cleaning</span
                >
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  class="w-5 h-5 border-outline rounded bg-surface focus:ring-0 text-primary"
                  type="checkbox"
                />
                <span class="font-body text-body group-hover:text-primary transition-colors"
                  >Deep Cleaning</span
                >
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  class="w-5 h-5 border-outline rounded bg-surface focus:ring-0 text-primary"
                  type="checkbox"
                />
                <span class="font-body text-body group-hover:text-primary transition-colors"
                  >Office / Commercial</span
                >
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  class="w-5 h-5 border-outline rounded bg-surface focus:ring-0 text-primary"
                  type="checkbox"
                />
                <span class="font-body text-body group-hover:text-primary transition-colors"
                  >Move In / Out</span
                >
              </label>
            </div>
          </div>
          <!-- Availability Filter -->
          <div class="space-y-4">
            <span
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >Availability</span
            >
            <select
              class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
            >
              <option>Next 24 Hours</option>
              <option>This Week</option>
              <option>Flexible Dates</option>
            </select>
          </div>
          <!-- Price Range -->
          <div class="space-y-4">
            <span
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >Price per Hour</span
            >
            <div class="flex items-center gap-2">
              <input
                class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
                placeholder="Min"
                type="text"
              />
              <span class="text-outline-variant">—</span>
              <input
                class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
                placeholder="Max"
                type="text"
              />
            </div>
          </div>
          <button
            class="w-full py-4 bg-primary text-on-primary font-label-md hover:bg-zinc-800 transition-colors"
          >
            Apply Filters
          </button>
          <button
            class="w-full py-4 bg-transparent border border-outline-variant text-primary font-label-md hover:bg-surface-container transition-colors"
          >
            Clear All
          </button>
        </div>
      </aside>

      <!-- Main Content: Cleaner List Cards -->
      <section class="flex-1 space-y-gutter">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 class="font-h1 text-h1">Available Cleaners</h1>
            <p class="text-secondary font-body mt-2">Showing 12 professionals in your area</p>
          </div>
          <div class="flex items-center gap-4 border-b border-outline-variant pb-2">
            <span class="font-label-md text-label-md text-secondary">Sort by:</span>
            <select
              class="bg-transparent border-none font-label-md focus:ring-0 p-0 cursor-pointer"
            >
              <option>Highest Rated</option>
              <option>Lowest Price</option>
              <option>Newest</option>
            </select>
          </div>
        </div>

        <!-- Results Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <!-- Card 1: Elena Sterling -->
          <div
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden group hover:border-primary transition-colors"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                alt="Cleaner Profile"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdjMug5Li34M26097szzPj7xhqTcI2C12H0SaVP4oxjjcrETNacp40mcjEw47NWWO21UwJoN7gKdgN4hDuGxlLs3NabAduwm9txS2BwlzD34hfmnsUtbl_tOijbH6Wx4C94xP6kPnKVC6NwKuTLjHpgxh7zLKcAEqhg-SQM_eAd4GdRx90ImDzfUXPopWo1DQ5rHddqdeBFFGYddZMqCwS_4vmcVPsJHe9NdmmC1WZytZYKrCGT8oiFr9pIfHzRcTVi5DIHHkyMg"
              />
              <div
                class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
              >
                Verified
              </div>
            </div>
            <div class="p-padding-card space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-h2 text-h2 text-primary">Elena Sterling</h2>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[18px] text-zinc-900 star-filled"
                      >star</span
                    >
                    <span class="font-label-md text-label-md">4.9</span>
                    <span class="text-secondary font-caption text-caption">(124 reviews)</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">$45</div>
                  <div class="text-secondary font-caption text-caption">per hour</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Residential</span
                >
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Eco-Friendly</span
                >
              </div>
              <div class="pt-4 flex items-center justify-between border-t border-outline-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-sm"
                    >calendar_today</span
                  >
                  <span class="font-caption text-caption text-secondary">Available tomorrow</span>
                </div>
                <button
                  class="px-6 py-2 bg-primary text-on-primary font-label-md active:scale-95 transition-all"
                  @click="viewProfile('cleaner-1')"
                >
                  Book Cleaner
                </button>
              </div>
            </div>
          </div>

          <!-- Card 2: Marcus Thorne -->
          <div
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden group hover:border-primary transition-colors"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                alt="Cleaner Profile"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQbuNqbJ254w4QTGNSgFzn7TlA1GnhpWuEwGHR_Id3mbuVDWgT2n9XjY4QuhACDPNLK26YVZxojHFgvLoPgcOrBk7YaUkouhhBJFgdktm3_jNgJPvg1B5JZi8t2fz8vt2kRQCIOtKTtCury5gsMFW1EsRyc9FMIVaROp57X2R2v_H1exMuCxPrGbd5TXP9WYgbpViKy6xjeZ6qa9rv6oue88zPNMXbQt9OBQYMphGanjzF9HzJpbwjNlEfwuaDDxDPaPTQstzZ4w"
              />
              <div
                class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
              >
                Premium
              </div>
            </div>
            <div class="p-padding-card space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-h2 text-h2 text-primary">Marcus Thorne</h2>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[18px] text-zinc-900 star-filled"
                      >star</span
                    >
                    <span class="font-label-md text-label-md">4.7</span>
                    <span class="text-secondary font-caption text-caption">(89 reviews)</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">$52</div>
                  <div class="text-secondary font-caption text-caption">per hour</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Deep Clean</span
                >
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Commercial</span
                >
              </div>
              <div class="pt-4 flex items-center justify-between border-t border-outline-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-sm">schedule</span>
                  <span class="font-caption text-caption text-secondary">Available Today</span>
                </div>
                <button
                  class="px-6 py-2 bg-primary text-on-primary font-label-md active:scale-95 transition-all"
                  @click="viewProfile('cleaner-2')"
                >
                  Book Cleaner
                </button>
              </div>
            </div>
          </div>

          <!-- Card 3: Sarah Chen -->
          <div
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden group hover:border-primary transition-colors"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                alt="Cleaner Profile"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7qr-x6wIPp3Xmajv9oZimWLgkvAZ3Zzx8g8VO4q08ViXvDe4Ix3VpmMLKR3bOcxyIw1-AbaX6MfbUEeyKrXi6dqt2AAIoqPUV6Mtt8ehSbFVmAqD7r5I7_hgXlK6WJlQyWjvZ-EPRguNK69GJlWV_wrCb7xF1zpLIFW3USzkBqHxLXZmYmE5eDBR6Hmgi5O_dIUDQJyjZdpFff6cfD4jQSxSkZS6u6qZU10pkxspMGM1Db4WIhULX29UU9P13TyM70oaiSRlW8w"
              />
            </div>
            <div class="p-padding-card space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-h2 text-h2 text-primary">Sarah Chen</h2>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[18px] text-zinc-900 star-filled"
                      >star</span
                    >
                    <span class="font-label-md text-label-md">5.0</span>
                    <span class="text-secondary font-caption text-caption">(42 reviews)</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">$38</div>
                  <div class="text-secondary font-caption text-caption">per hour</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Residential</span
                >
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Move In</span
                >
              </div>
              <div class="pt-4 flex items-center justify-between border-t border-outline-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-sm"
                    >event_available</span
                  >
                  <span class="font-caption text-caption text-secondary">Available Monday</span>
                </div>
                <button
                  class="px-6 py-2 bg-primary text-on-primary font-label-md active:scale-95 transition-all"
                  @click="viewProfile('cleaner-3')"
                >
                  Book Cleaner
                </button>
              </div>
            </div>
          </div>

          <!-- Card 4: Julian Vance -->
          <div
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden group hover:border-primary transition-colors"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                alt="Cleaner Profile"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQlkQJueek6_fYFgEpvVkdZGSUoHksLRVtGX7vtqeQv2FWGf0lohhXTd0ZnLllyH7wA1W9PBhhFSwInTiyglLouEvNIQRrO7aj4nS1TBxEdesYqRWlsHB0XidBVJ3EnKKPfrt4LsyxqC38m1am74AoTdljU67FHI4TCXl5qdZ2UQTNY8Wmm9gVxSxeqd2_sOEbG-FzCu9sjyQS6slxpIJV14pWaHiyDY5B53UubWq1RbD4R3qsCV2UTdSGrWLdbJ-ov9f1V_H98w"
              />
            </div>
            <div class="p-padding-card space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-h2 text-h2 text-primary">Julian Vance</h2>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[18px] text-zinc-900 star-filled"
                      >star</span
                    >
                    <span class="font-label-md text-label-md">4.8</span>
                    <span class="text-secondary font-caption text-caption">(215 reviews)</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">$40</div>
                  <div class="text-secondary font-caption text-caption">per hour</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Residential</span
                >
                <span
                  class="bg-surface-container px-3 py-1 font-caption text-[10px] uppercase tracking-wider text-secondary"
                  >Appliance Care</span
                >
              </div>
              <div class="pt-4 flex items-center justify-between border-t border-outline-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-sm">schedule</span>
                  <span class="font-caption text-caption text-secondary">In high demand</span>
                </div>
                <button
                  class="px-6 py-2 bg-primary text-on-primary font-label-md active:scale-95 transition-all"
                  @click="viewProfile('cleaner-4')"
                >
                  Book Cleaner
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="flex justify-center items-center gap-4 pt-12">
          <button
            class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary transition-colors"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <div class="flex items-center gap-2">
            <button
              class="w-10 h-10 flex items-center justify-center bg-primary text-on-primary font-label-md"
            >
              1
            </button>
            <button
              class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary font-label-md"
            >
              2
            </button>
            <button
              class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary font-label-md"
            >
              3
            </button>
          </div>
          <button
            class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary transition-colors"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function viewProfile(cleanerId: string) {
  router.push({ name: 'RequestBooking', query: { cleanerId } })
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  vertical-align: middle;
}

.star-filled {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
@media (min-width: 1024px) {
  .lg\:w-72 {
    width: 18rem;
  }
}
</style>
