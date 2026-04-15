<template>
  <main class="servicesPage">
    <section class="servicesHero">
      <p class="eyebrow">Services</p>
      <h1>Cleaning support across homes, workplaces, vehicles, outdoor areas, and specialist jobs.</h1>
      <p class="heroText">
        Browse the full range of services available through Cleanlyst and choose the type of clean
        that best fits your space and schedule.
      </p>
    </section>

    <section class="serviceGrid">
      <article v-for="service in services" :key="service.title" class="serviceCard">
        <h2>{{ service.title }}</h2>
        <p>{{ service.description }}</p>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
const services = [
  {
    title: 'Home Cleaning',
    description: 'Routine cleaning for apartments, houses, and everyday household upkeep.',
  },
  {
    title: 'Commercial & Office Cleaning',
    description: 'Reliable cleaning for offices, shops, studios, and shared workspaces.',
  },
  {
    title: 'Windows & Glass',
    description: 'Cleaning for windows, mirrors, partitions, and glass surfaces inside and out.',
  },
  {
    title: 'Vehicle & Mobility Cleaning',
    description: 'Interior and surface cleaning for cars, vans, and mobility equipment.',
  },
  {
    title: 'Specialist Interior Cleaning',
    description: 'Focused cleaning for carpets, upholstery, mattresses, and delicate interior finishes.',
  },
  {
    title: 'Exterior & Outdoor Cleaning',
    description: 'Practical cleaning for patios, driveways, garden areas, and outdoor surfaces.',
  },
  {
    title: 'Bin & Waste Cleaning',
    description: 'Sanitising and refreshing bins, waste storage areas, and high-use disposal spaces.',
  },
  {
    title: 'Specialist & High-Level Services',
    description: 'Support for deep cleans, post-build work, and harder-to-reach areas.',
  },
  {
    title: 'Personal Item Cleaning',
    description: 'Care for selected personal items such as trainers, bags, curtains, and more.',
  },
]
</script>

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
