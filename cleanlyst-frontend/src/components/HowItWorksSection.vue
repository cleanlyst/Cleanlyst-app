<template>
  <section class="howItWorks">
    <div class="sectionIntro">
      <h2 class="h4">How it works</h2>
      <p>Book trusted cleaners in just a few simple steps.</p>
    </div>

    <div class="stepsGrid">
      <article v-for="step in steps" :key="step.title" class="stepCard">
        <img :src="step.image" :alt="step.title" class="stepImage" />
        <h2 class="h6 step-title">{{ step.title }}</h2>
        <p class="small">{{ step.description }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import searchImage from '@/assets/search.png'
import bookImage from '@/assets/schedule.png'
import enjoyImage from '@/assets/wipe.png'

const steps = [
  {
    title: 'Choose Your Service',
    description:
      'Start with your location and choose the type of cleaning you need, from home and office cleaning to specialist services.',
    image: searchImage,
  },
  {
    title: 'Book Your Clean',
    description:
      'Confirm the service you want and send your booking request with less back and forth.',
    image: bookImage,
  },
  {
    title: 'Enjoy a Freshly Cleaned Space',
    description:
      'Whether it is your home, workplace, vehicle, or outdoor space, enjoy a cleaner result without the usual hassle.',
    image: enjoyImage,
  },
]
</script>

<style scoped>
.howItWorks {
  padding: 4rem 30px 2rem;
}

.sectionIntro {
  max-width: 42rem;
  margin: 0 auto 2rem;
  text-align: center;
  color: #13223b;
}

.eyebrow {
  margin: 0 0 0.85rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cf5d34;
}

.sectionIntro h2 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.sectionIntro p:last-child {
  margin: 1rem 0 0;
  line-height: 1.7;
  color: #4f5c73;
}

.stepsGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.stepCard {
  padding: 1.6rem;
  border-radius: 28px;
  border: 1px solid rgba(19, 34, 59, 0.08);
  box-shadow: 0 18px 50px rgba(19, 34, 59, 0.07);
  color: #13223b;
}

.stepImage {
  display: block;
  width: 100%;
  max-width: 70px;
  margin-bottom: 1.25rem;
}

.stepCard h3 {
  margin: 0 0 0.75rem;
  font-size: 1.2rem;
}

.stepCard p {
  margin: 0;
  line-height: 1.7;
  color: #4f5c73;
}

@media (max-width: 900px) {
  .stepsGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stepCard:last-child {
    grid-column: 1 / -1;
    max-width: calc(50% - 0.5rem);
    justify-self: center;
  }
}

@media (max-width: 720px) {
  .howItWorks {
    padding: 2.5rem 10px 1rem;
  }

  .stepCard {
    padding: 1.35rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .stepImage {
    max-width: 45px;
  }
  .step-title {
    margin: 10px 0;
  }
}
</style>
