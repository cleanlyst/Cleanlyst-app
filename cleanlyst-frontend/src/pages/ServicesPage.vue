<template>
  <section class="servicesHero">
    <h2 class="h6">
      Cleaning support across homes, workplaces, vehicles, outdoor areas, and specialist jobs.
    </h2>
    <p class="heroText">
      Browse the full range of services available through Cleanlyst and choose the type of clean
      that best fits your space and schedule.
    </p>
  </section>

  <div class="carouselContainer">
    <button
      class="carouselBtn carouselPrev hide-desktop"
      @click="scrollCarousel(-1)"
      aria-label="Previous"
    >
      ‹
    </button>

    <section class="serviceGrid" ref="carouselRef">
      <article v-for="service in services" :key="service.title" class="serviceCard">
        <img :src="service.image" :alt="service.title" class="serviceImage" />
        <div class="serviceContent">
          <p class="boldFont text-underline">{{ service.title }}</p>
          <p class="small">{{ service.description }}</p>
        </div>
        <div class="book-service-CTA">
          <button type="submit" class="blueButton">Book Service</button>
        </div>
      </article>
    </section>

    <button
      class="carouselBtn carouselNext hide-desktop"
      @click="scrollCarousel(1)"
      aria-label="Next"
    >
      ›
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import homeImage from '@/assets/landingpage.png'
import officeImage from '@/assets/office.jpg'
import windowImage from '@/assets/window.jpg'
import vehicleImage from '@/assets/vehicle.jpg'
import specialistInteriorImage from '@/assets/specialist-interior.jpg'
import outdoorImage from '@/assets/outdoor.jpg'
import binImage from '@/assets/bin.jpg'
import specialistImage from '@/assets/specialist.jpg'
import personalItemImage from '@/assets/personal-item.jpg'

const carouselRef = ref<HTMLElement | null>(null)

function scrollCarousel(direction: number) {
  if (!carouselRef.value) return
  const scrollAmount = carouselRef.value.clientWidth * 0.85
  carouselRef.value.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth',
  })
}

const services = [
  {
    title: 'Home Cleaning',
    description: 'Routine cleaning for apartments, houses, and everyday household upkeep.',
    image: homeImage,
  },
  {
    title: 'Commercial & Office Cleaning',
    description: 'Reliable cleaning for offices, shops, studios, and shared workspaces.',
    image: officeImage,
  },
  {
    title: 'Windows & Glass',
    description: 'Cleaning for windows, mirrors, partitions, and glass surfaces inside and out.',
    image: windowImage,
  },
  {
    title: 'Vehicle & Mobility Cleaning',
    description: 'Interior and surface cleaning for cars, vans, and mobility equipment.',
    image: vehicleImage,
  },
  {
    title: 'Specialist Interior Cleaning',
    description:
      'Focused cleaning for carpets, upholstery, mattresses, and delicate interior finishes.',
    image: specialistInteriorImage,
  },
  {
    title: 'Exterior & Outdoor Cleaning',
    description: 'Practical cleaning for patios, driveways, garden areas, and outdoor surfaces.',
    image: outdoorImage,
  },
  {
    title: 'Bin & Waste Cleaning',
    description:
      'Sanitising and refreshing bins, waste storage areas, and high-use disposal spaces.',
    image: binImage,
  },
  {
    title: 'Specialist & High-Level Services',
    description: 'Support for deep cleans, post-build work, and harder-to-reach areas.',
    image: specialistImage,
  },
  {
    title: 'Personal Item Cleaning',
    description: 'Care for selected personal items such as trainers, bags, curtains, and more.',
    image: personalItemImage,
  },
]
</script>

<style scoped>
.servicesHero,
.serviceGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.servicesHero {
  padding: 1rem 3rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 1;
}

.heroText {
  max-width: 42rem;
  margin: 1.25rem 0 0;
}

.serviceGrid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.serviceCard {
  min-height: 280px;
  padding: 1.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.serviceImage {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 18px;
}

.serviceContent {
  position: relative;
  z-index: 1;
}

.serviceCard h2 {
  margin-top: 0;
}

.serviceCard p {
  margin-bottom: 0;
  line-height: 1.7;
}
.book-service-CTA {
  margin: 10px 0;
}

@media (max-width: 900px) {
  .servicesHero {
    padding: 2rem;
  }

  .carouselContainer {
    position: relative;
    display: flex;
    align-items: center;
  }

  .carouselBtn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--blue, #0b2d72);
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .carouselPrev {
    left: 4px;
  }

  .carouselNext {
    right: 4px;
  }

  .serviceGrid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 0;
    padding: 0 35px;
  }

  .serviceGrid::-webkit-scrollbar {
    display: none;
  }

  .serviceCard {
    min-width: 100%;
    min-height: 220px;
    scroll-snap-align: center;
    padding-right: 1.5rem;
    padding-left: 1.5rem;
    margin: 0 5px;
  }
}
</style>
