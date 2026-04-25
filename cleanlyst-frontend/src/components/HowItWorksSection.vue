<template>
  <section class="howItWorks">
    <div class="sectionIntro">
      <h2 class="h4 no-margin">How it works</h2>
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
  padding: 2rem 3rem;
}

.sectionIntro {
  max-width: 42rem;
}

.stepsGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
.step-title {
  text-align: center;
}

.stepCard {
  padding: 1.6rem;
}

.stepImage {
  display: block;
  width: 60px;
  max-width: 70px;
  margin: 0 auto 10px;
}
.stepCard p {
  margin: 0;
  color: #4f5c73;
}

@media (max-width: 720px) {
  .howItWorks {
    padding: 2.5rem 10px 1rem;
  }

  .stepCard {
    padding: 0;
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
    font-size: 15px;
  }
}
</style>
