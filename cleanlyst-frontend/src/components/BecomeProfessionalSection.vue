<template>
  <section class="becomeProfessional">
    <div class="professionalGrid">
      <div class="contentCard">
        <h2 class="h4">Become a Cleanlyst Professional</h2>
        <p class="supportText">
          Join Cleanlyst to receive booking requests, grow your client base, and manage your work
          from one place.
        </p>
        <router-link
          :to="{ name: 'Auth', query: { mode: 'signup' } }"
          class="greenButton applyButton"
        >
          Apply as a cleaner
        </router-link>
      </div>

      <div class="imageCard hide-mobile">
        <img :src="proImage" alt="Cleanlyst cleaner application" class="professionalImage" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import proImage from '@/assets/become-pro.jpg'
</script>

<style scoped>
.becomeProfessional {
  padding: 1rem 30px 4rem;
  background: var(--lightBlue);
}

.professionalGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 10px 0;
}

.contentCard,
.imageCard {
  min-height: 360px;
  border-radius: 28px;
  overflow: hidden;
}

.contentCard {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eyebrow {
  margin: 0 0 0.85rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cf5d34;
}

.contentCard h2 {
  margin: 0;
  line-height: 1.05;
}

.supportText {
  max-width: 28rem;
  margin: 1rem 0 0;
  line-height: 1.7;
  color: #4f5c73;
}

.applyButton {
  align-self: flex-start;
  margin-top: 1.5rem;
  text-decoration: none;
}

.professionalImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 900px) {
  .professionalGrid {
    grid-template-columns: 1fr;
  }

  .contentCard,
  .imageCard {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .becomeProfessional {
    padding: 0.5rem 10px 3rem;
  }

  .contentCard {
    padding: 1.5rem;
  }
}
</style>
