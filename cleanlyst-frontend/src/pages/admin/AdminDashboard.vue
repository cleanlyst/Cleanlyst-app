<template>
  <main class="dashboardPage">
    <section class="heroCard">
      <p class="eyebrow">Admin dashboard</p>
      <h1>Platform overview</h1>
      <p>Use this area to review marketplace activity, approvals, and the operational metrics from your MVP scope.</p>
    </section>

    <section class="grid">
      <article class="panel">
        <p class="panelEyebrow">Approvals</p>
        <h2>Cleaner reviews</h2>
        <ul class="list">
          <li>Pending cleaner applications and document review will live here in phase 6.</li>
          <li>Use role-based routing now to keep admin access separate from customer and cleaner flows.</li>
        </ul>
      </article>

      <article class="panel">
        <p class="panelEyebrow">Revenue</p>
        <h2>Commercial metrics</h2>
        <ul class="list">
          <li>Revenue, booking volume, and fee configuration connect cleanly to the later admin APIs.</li>
          <li>This page is the redirect target for admin authentication starting in phase 2.</li>
        </ul>
      </article>
    </section>
  </main>
</template>

<style scoped>
.dashboardPage {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.heroCard,
.panel {
  padding: 2rem;
  border-radius: 28px;
  border: 1px solid rgba(16, 35, 61, 0.08);
  box-shadow: 0 24px 60px rgba(16, 35, 61, 0.08);
}

.heroCard {
  color: #f7f2e9;
  background: linear-gradient(135deg, #10233d 0%, #1e4365 100%);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: 1.25rem;
}

.panel {
  background: rgba(255, 252, 246, 0.94);
}

.eyebrow,
.panelEyebrow {
  margin: 0 0 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.82rem;
}

.eyebrow {
  color: rgba(247, 242, 233, 0.72);
}

.panelEyebrow {
  color: rgba(16, 35, 61, 0.52);
}

h1,
h2 {
  margin: 0;
  color: #10233d;
}

.heroCard h1,
.heroCard p {
  color: #f7f2e9;
}

.list {
  margin: 1rem 0 0;
  padding-left: 1.2rem;
  color: #425168;
}

@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
