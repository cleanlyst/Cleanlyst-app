<template>
  <section class="ourServices">
    <div class="sectionIntro">
      <h2 class="h4">Our Services</h2>
      <p>Professional cleaning support across homes, workplaces, outdoor areas, and specialist jobs.</p>
    </div>

    <div class="servicesGrid">
      <article
        v-for="service in featuredServices"
        :key="service.title"
        class="serviceCard"
        :style="{ backgroundImage: `linear-gradient(180deg, rgba(11, 45, 114, 0.16) 0%, rgba(8, 18, 34, 0.78) 100%), url(${landingImage})` }"
      >
        <div class="serviceContent">
          <h3 class="h6">{{ service.title }}</h3>
          <p class="small">{{ service.description }}</p>
        </div>
      </article>

      <router-link
        :to="{ name: 'Services' }"
        class="serviceCard serviceCardLink"
        :style="{ backgroundImage: `linear-gradient(180deg, rgba(64, 138, 113, 0.18) 0%, rgba(8, 18, 34, 0.82) 100%), url(${landingImage})` }"
      >
        <div class="serviceContent">
          <h3 class="h6">More services we offer</h3>
          <p class="small">Explore the full range of cleaning services available through Cleanlyst.</p>
        </div>
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import landingImage from '@/assets/landingpage.png'

const featuredServices = [
  {
    title: 'Home Cleaning',
    description: 'Routine cleaning for apartments and houses.',
  },
  {
    title: 'Commercial & Office Cleaning',
    description: 'Reliable cleaning for offices, shops, and shared workspaces.',
  },
  {
    title: 'Windows & Glass',
    description: 'Clearer windows, mirrors, and glass surfaces inside and out.',
  },
]
</script>

<style scoped>
.ourServices {
  padding: 4rem 30px 3rem;
}

.sectionIntro {
  max-width: 42rem;
  margin: 0 auto 2rem;
  text-align: center;
  color: #13223b;
}

.sectionIntro h2 {
  margin: 0;
  line-height: 1.05;
}

.sectionIntro p {
  margin: 1rem 0 0;
  line-height: 1.7;
  color: #4f5c73;
}

.servicesGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.serviceCard {
  position: relative;
  min-height: 280px;
  padding: 1.5rem;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(19, 34, 59, 0.08);
  box-shadow: 0 18px 50px rgba(19, 34, 59, 0.07);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  display: flex;
  align-items: flex-end;
}

.serviceCardLink {
  text-decoration: none;
}

.serviceCard::after {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(1px);
}

.serviceContent {
  position: relative;
  z-index: 1;
  color: var(--white);
}

.serviceContent h3 {
  margin: 0 0 0.75rem;
}

.serviceContent p {
  margin: 0;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

@media (max-width: 1100px) {
  .servicesGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ourServices {
    padding: 2.5rem 10px 2rem;
  }

  .serviceCard {
    min-height: 220px;
  }
}
</style>
