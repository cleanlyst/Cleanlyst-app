<template>
  <div class="application-review-admin-page font-body text-body text-on-background antialiased">
    <main class="pt-24 pb-12 px-6 lg:px-12 max-w-7xl mx-auto min-h-screen">
      <!-- Header Actions -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h1 class="font-h1 text-h1 text-primary">Application: Sarah Jenkins</h1>
          <p class="text-secondary mt-1">Submitted Oct 24, 2024 • ID: APP-99281</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            class="px-6 py-3 border border-outline-variant text-primary font-label-md text-label-md hover:bg-surface-container transition-colors active:scale-95"
          >
            Request more info
          </button>
          <button
            class="px-6 py-3 border border-error text-error font-label-md text-label-md hover:bg-error-container transition-colors active:scale-95"
          >
            Reject
          </button>
          <button
            class="px-6 py-3 bg-primary text-white font-label-md text-label-md hover:bg-zinc-800 transition-colors active:scale-95"
          >
            Approve Application
          </button>
        </div>
      </div>
      <!-- Asymmetric Bento Grid Layout -->
      <div class="grid grid-cols-12 gap-8">
        <!-- Profile Section (Primary Content) -->
        <div class="col-span-12 lg:col-span-8 space-y-8">
          <!-- Personal Info Card -->
          <div class="bg-white border border-zinc-200 p-padding-card">
            <h2 class="font-h2 text-h2 mb-6 border-b border-zinc-100 pb-4">Personal Details</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              <div class="space-y-1">
                <label
                  class="font-label-md text-label-md text-secondary uppercase tracking-wider text-[10px]"
                  >Full Name</label
                >
                <p class="font-body text-body">Sarah Elizabeth Jenkins</p>
              </div>
              <div class="space-y-1">
                <label
                  class="font-label-md text-label-md text-secondary uppercase tracking-wider text-[10px]"
                  >Email Address</label
                >
                <p class="font-body text-body">s.jenkins.clean@example.com</p>
              </div>
              <div class="space-y-1">
                <label
                  class="font-label-md text-label-md text-secondary uppercase tracking-wider text-[10px]"
                  >Phone Number</label
                >
                <p class="font-body text-body">+1 (555) 012-3456</p>
              </div>
              <div class="space-y-1">
                <label
                  class="font-label-md text-label-md text-secondary uppercase tracking-wider text-[10px]"
                  >Location</label
                >
                <p class="font-body text-body">Seattle, WA • Greater Metro Area</p>
              </div>
              <div class="col-span-full space-y-1 pt-4">
                <label
                  class="font-label-md text-label-md text-secondary uppercase tracking-wider text-[10px]"
                  >Professional Summary</label
                >
                <p class="font-body text-body leading-relaxed">
                  Experienced residential and commercial cleaner with over 8 years in the industry.
                  Specialized in eco-friendly cleaning solutions and high-end residential
                  maintenance. Previously managed a small team of three cleaners for corporate
                  office contracts.
                </p>
              </div>
            </div>
          </div>
          <!-- Document Previews -->
          <div class="space-y-6">
            <h2 class="font-h2 text-h2">Verification Documents</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- ID Preview -->
              <div class="bg-white border border-zinc-200 overflow-hidden group">
                <div class="h-48 bg-surface-container relative">
                  <img
                    class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    data-alt="A macro photograph of a professional identification card lying on a clean, light-colored desk. The lighting is bright and uniform, reflecting a modern workspace environment. The image emphasizes a clean, minimalist professional aesthetic with high-key lighting and a monochromatic palette of whites and soft greys. The atmosphere is official and trustworthy."
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXnMKAz8l2KgnTaGnIRRn0mkJa79plF7t7qTsefkzTj4JpPMjush9s4r8SQdAPyR3DPxjf9tfmZ0Pp0BTnGef1EE251gk4rZ6oF7ofeEqOoU1snyyEMcJlvt_V9PZ9Xzde5dZvEyuple4KLAitg-C3zQG1Z1D_c52JDQjhdyKaBzYmq9TsWUc3_2JltCvYjeqgi9PV1NNTvKNCzeLbaH42QITUMlcB29vYgg8uUIiWOmnWe8-MJhfixntzbBb467_ZJq5utNaFiw"
                  />
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <button
                      class="bg-white px-4 py-2 text-primary font-label-md text-label-md flex items-center gap-2"
                    >
                      <span class="material-symbols-outlined text-[18px]">visibility</span> View
                      Full Size
                    </button>
                  </div>
                </div>
                <div class="p-4 border-t border-zinc-200 flex justify-between items-center">
                  <div>
                    <p class="font-label-md text-label-md">Government Issued ID</p>
                    <p class="text-caption text-secondary uppercase text-[10px]">
                      Verified Authenticity
                    </p>
                  </div>
                  <span class="material-symbols-outlined text-zinc-400">verified_user</span>
                </div>
              </div>
              <!-- Insurance Certificate -->
              <div class="bg-white border border-zinc-200 overflow-hidden group">
                <div class="h-48 bg-surface-container relative">
                  <img
                    class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    data-alt="A high-contrast, professional-looking document or certificate with official-looking stamps and signatures. The setting is a minimalist office with harsh, clean light and dark shadows that give it a sense of high importance and professionalism. The color palette is strictly monochromatic, dominated by bright whites and deep blacks, evoking a mood of corporate security."
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC2MNypgBrpA6Hq_3dtgU9eXc1k6oWcf7wgWV1FllXqyUUlom1E0bYPTzDLOvb0bB71mDUXqi0lNmueik67Yv_LteKkH8wjdpUfEZQ0cgaVsRni6qLQJSIhvxctlkwLItGktKn5fNoFZQtXWc29LIOjQSFdbpWTFCwpxkDoxPBFhqoXd_qAjwpkuGVkq7M_KJqzY3oUXRq35fMAgfAexmK7ClOhlzdHAUnkatWHY0VCLcML4pKB8bOVhOX47xKH77VVGmUfsf5wSg"
                  />
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <button
                      class="bg-white px-4 py-2 text-primary font-label-md text-label-md flex items-center gap-2"
                    >
                      <span class="material-symbols-outlined text-[18px]">visibility</span> View
                      Full Size
                    </button>
                  </div>
                </div>
                <div class="p-4 border-t border-zinc-200 flex justify-between items-center">
                  <div>
                    <p class="font-label-md text-label-md">General Liability Insurance</p>
                    <p class="text-caption text-secondary uppercase text-[10px]">
                      Expires Dec 2025
                    </p>
                  </div>
                  <span class="material-symbols-outlined text-zinc-400">policy</span>
                </div>
              </div>
              <!-- Background Check -->
              <div
                class="bg-white border border-zinc-200 overflow-hidden group col-span-1 md:col-span-2"
              >
                <div class="p-6 flex items-center gap-6">
                  <div class="w-16 h-16 bg-zinc-100 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-[32px]"
                      >fact_check</span
                    >
                  </div>
                  <div class="flex-1">
                    <p class="font-label-md text-label-md">Background Screening Results</p>
                    <p class="text-body text-secondary">
                      No criminal records found. Screening performed by VerifiedBackground Inc.
                    </p>
                  </div>
                  <button
                    class="px-4 py-2 border border-outline-variant hover:bg-surface-container font-label-md text-label-md transition-colors"
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Sidebar (Metadata & Context) -->
        <div class="col-span-12 lg:col-span-4 space-y-8">
          <!-- Status Card -->
          <div class="bg-zinc-900 text-white p-padding-card">
            <h3 class="font-label-md text-label-md uppercase tracking-widest text-zinc-400 mb-4">
              Current Status
            </h3>
            <div class="flex items-center gap-3 mb-6">
              <span class="w-3 h-3 bg-zinc-400 rounded-full animate-pulse"></span>
              <p class="font-h2 text-h2">Under Review</p>
            </div>
            <div class="space-y-4 pt-6 border-t border-zinc-800">
              <div class="flex justify-between text-caption">
                <span class="text-zinc-400">Background Check</span>
                <span class="text-white font-medium">CLEARED</span>
              </div>
              <div class="flex justify-between text-caption">
                <span class="text-zinc-400">Document Audit</span>
                <span class="text-white font-medium">PENDING</span>
              </div>
              <div class="flex justify-between text-caption">
                <span class="text-zinc-400">Profile Completeness</span>
                <span class="text-white font-medium">92%</span>
              </div>
            </div>
          </div>
          <!-- Reference Check -->
          <div class="bg-white border border-zinc-200 p-padding-card">
            <h3 class="font-h2 text-h2 mb-4">References</h3>
            <div class="space-y-6">
              <div class="p-4 bg-zinc-50 border-l-2 border-primary">
                <p class="font-label-md text-label-md">Mark Robertson</p>
                <p class="text-caption text-secondary mb-2">Property Manager</p>
                <p class="text-body text-[14px] italic">
                  "Sarah was the most reliable contractor I worked with at the Pacific Heights
                  complex."
                </p>
              </div>
              <div class="p-4 bg-zinc-50 border-l-2 border-primary">
                <p class="font-label-md text-label-md">Linda Chen</p>
                <p class="text-caption text-secondary mb-2">Former Employer</p>
                <p class="text-body text-[14px] italic">
                  "Exemplary attention to detail and always on time. Highly recommend for
                  residential work."
                </p>
              </div>
            </div>
          </div>
          <!-- Admin Notes -->
          <div class="bg-white border border-zinc-200 p-padding-card">
            <h3 class="font-h2 text-h2 mb-4">Internal Notes</h3>
            <textarea
              class="w-full bg-zinc-50 border border-zinc-200 p-3 h-32 font-body text-body focus:border-primary outline-none resize-none mb-4"
              placeholder="Add a note about this applicant..."
            ></textarea>
            <button
              class="w-full py-2 bg-primary text-white font-label-md text-label-md hover:bg-zinc-800 transition-colors"
            >
              Save Note
            </button>
            <div class="mt-6 space-y-3">
              <div class="text-caption">
                <span class="font-semibold">Admin (You):</span> "Verified insurance details, looks
                legitimate. Waiting on photo ID zoom."
                <p class="text-zinc-400 mt-1">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
.application-review-admin-page {
  background-color: #f9f9f9;
}
</style>
