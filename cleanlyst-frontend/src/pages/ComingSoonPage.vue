<template>
  <div class="row no-gutter">
    <section class="col-lg-7 dashboard-container">
      <img :src="logoImage" alt="" class="logo-image" />
    </section>
    <section class="col-lg-5 coming-soon-container">
      <h2 class="launchingSoon h6">Launching soon...</h2>
      <p class="coming-soon-title boldFont">Trusted cleaners. Smarter booking. Coming soon.</p>
      <p class="coming-soon-description">
        Cleanlyst is launching soon — the easier way to book professional cleaners, and the smarter
        way for cleaners to manage bookings and earnings.
      </p>
    </section>
  </div>
</template>
<script lang="ts" setup>
import logoImage from '@/assets/coming-soon-hero.jpg'
</script>

<style scoped>
.dashboard-container,
.coming-soon-container {
  height: calc(100vh - 50px);
}
.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.coming-soon-container {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px 30px;
}
@media (max-width: 768px) {
  .dashboard-container {
    height: 30vh;
  }
  .coming-soon-container {
    height: 60vh;
    padding: 10px;
  }
}
</style>
