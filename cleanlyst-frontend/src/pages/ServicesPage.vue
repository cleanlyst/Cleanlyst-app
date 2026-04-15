<template>
  <main class="servicesPage">
    <section class="servicesHero">
      <p class="eyebrow">Services</p>
      <h1>Flexible cleaning support for homes, routines, and one-off resets.</h1>
      <p class="heroText">
        Cleanlyst is built to make it easier to browse trusted options, compare service types, and
        book the kind of help that fits your schedule.
      </p>
    </section>

    <section class="serviceGrid">
      <article class="serviceCard">
        <h2>Standard home clean</h2>
        <p>Ideal for regular upkeep, kitchen and bathroom refreshes, dusting, vacuuming, and tidying.</p>
      </article>
      <article class="serviceCard">
        <h2>Deep clean</h2>
        <p>For first visits, seasonal resets, or homes that need extra attention in high-use areas.</p>
      </article>
      <article class="serviceCard">
        <h2>Move-in or move-out</h2>
        <p>Support for handovers, fresh starts, and preparing a space for the next resident.</p>
      </article>
      <article class="serviceCard">
        <h2>Kitchen focus</h2>
        <p>Detailed wipe-downs, surface care, appliance exteriors, and a sharper finish where it matters.</p>
      </article>
      <article class="serviceCard">
        <h2>Bathroom refresh</h2>
        <p>Practical care for sinks, showers, mirrors, tiles, and the everyday details that build up fast.</p>
      </article>
      <article class="serviceCard">
        <h2>Recurring visits</h2>
        <p>Weekly or fortnightly routines designed for busy households that want a dependable reset.</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.servicesPage {
  min-height: calc(100vh - 82px);
  padding: 3rem 1rem 4rem;
  background:
    radial-gradient(circle at top right, rgba(231, 119, 86, 0.2), transparent 28%),
    radial-gradient(circle at bottom left, rgba(16, 35, 61, 0.16), transparent 30%),
    linear-gradient(180deg, #f8f4ec 0%, #efe5d7 100%);
  color: #13223b;
}

.servicesHero,
.serviceGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.servicesHero {
  padding: 3rem;
  border-radius: 32px;
  border: 1px solid rgba(19, 34, 59, 0.08);
  background: rgba(255, 252, 246, 0.9);
  box-shadow: 0 22px 60px rgba(19, 34, 59, 0.08);
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cf5d34;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 1;
}

.heroText {
  max-width: 42rem;
  margin: 1.25rem 0 0;
  line-height: 1.7;
  color: #41506a;
}

.serviceGrid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.serviceCard {
  padding: 1.75rem;
  border-radius: 24px;
  border: 1px solid rgba(19, 34, 59, 0.08);
  background: rgba(255, 252, 246, 0.92);
  box-shadow: 0 18px 50px rgba(19, 34, 59, 0.07);
}

.serviceCard h2 {
  margin-top: 0;
}

.serviceCard p {
  margin-bottom: 0;
  line-height: 1.7;
  color: #41506a;
}

@media (max-width: 900px) {
  .servicesHero {
    padding: 2rem;
  }

  .serviceGrid {
    grid-template-columns: 1fr;
  }
}
</style>
