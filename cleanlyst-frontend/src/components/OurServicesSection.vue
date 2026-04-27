<template>
  <section class="ourServices">
    <div class="sectionIntro">
      <div class="section-header">
        <h2 class="h6">Our Services</h2>

        <router-link :to="{ name: 'Services' }">
          <span class="pointer text-underline">View all</span>
        </router-link>
      </div>

      <p>
        Professional cleaning support across homes, workplaces, outdoor areas, and specialist jobs.
      </p>
    </div>

    <div class="carouselContainer">
      <button
        class="carouselBtn carouselPrev hide-desktop"
        @click="scrollCarousel(-1)"
        aria-label="Previous"
      >
        ‹
      </button>

      <div class="servicesGrid" ref="carouselRef">
        <article
          v-for="service in featuredServices"
          :key="service.title"
          class="serviceCard pointer"
        >
          <img :src="service.image" :alt="service.title" class="serviceImage" />
          <div class="serviceContent">
            <p class="boldFont">{{ service.title }}</p>
            <p class="small no-margin">{{ service.description }}</p>
          </div>
        </article>
      </div>

      <button
        class="carouselBtn carouselNext hide-desktop"
        @click="scrollCarousel(1)"
        aria-label="Next"
      >
        ›
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import homeImage from '@/assets/home.jpg'
import officeImage from '@/assets/office.jpg'
import windowImage from '@/assets/window.jpg'
import vehicleImage from '@/assets/vehicle.jpg'

const carouselRef = ref<HTMLElement | null>(null)

function scrollCarousel(direction: number) {
  if (!carouselRef.value) return
  const scrollAmount = carouselRef.value.clientWidth * 0.85
  carouselRef.value.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth',
  })
}

const featuredServices = [
  {
    title: 'Home Cleaning',
    description: 'Routine cleaning for apartments and houses.',
    image: homeImage,
  },
  {
    title: 'Commercial & Office Cleaning',
    description: 'Reliable cleaning for offices, shops, and shared workspaces.',
    image: officeImage,
  },
  {
    title: 'Windows & Glass',
    description: 'Clearer windows, mirrors, and glass surfaces inside and out.',
    image: windowImage,
  },
  {
    title: 'Vehicle & Mobility Cleaning',
    description: 'Interior and surface cleaning for cars, vans, and mobility equipment.',
    image: vehicleImage,
  },
]
</script>

<style scoped>
.ourServices {
  padding: 2rem 3rem;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sectionIntro h2 {
  margin: 0;
}

.sectionIntro p {
  margin: 1rem 0 0;
}

.servicesGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.serviceCard {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
}
img.serviceImage {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: 18px;
}
a.serviceMoreCard.serviceCardLink {
  margin-top: 18px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
img.moreImage {
  width: 60px;
  height: 60px;
  object-fit: contain;
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

  .carouselContainer {
    position: relative;
    display: flex;
    align-items: center;
  }

  img.serviceImage {
    height: 250px;
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
    left: 0;
  }

  .carouselNext {
    right: 0;
  }

  .servicesGrid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 0;
    padding: 0 35px;
  }

  .servicesGrid::-webkit-scrollbar {
    display: none;
  }

  .serviceCard,
  .serviceMoreCard {
    --padding: 1.5rem;
    flex-grow: 1;
    padding-right: var(--padding);
    padding-left: var(--padding);
    min-width: 100%;
    transition: 1s ease-in-out;
    margin-top: auto;
    margin-bottom: auto;
    scroll-snap-align: center;
  }

  .serviceCard {
    min-height: 220px;
  }
}
</style>
