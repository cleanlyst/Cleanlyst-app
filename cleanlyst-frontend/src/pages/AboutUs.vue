<template>
  <section class="hero-img">
    <div class="hero-img-container">
      <img :src="heroImage" alt="" class="hero-image-asset" />
      <h2 class="h6 white-text about-us-header">About Us</h2>
    </div>
  </section>
  <section class="about-us-text">
    <h2 class="h6">
      We are passionate about transforming spaces and enhancing lives through our professional
      cleaning.
    </h2>
    <p>
      At Cleanlyst, we are dedicated to transforming spaces with professional cleaning services for
      homes, workplaces, vehicles, and outdoor areas. We focus on quality, reliability, and customer
      satisfaction, delivering spotless results through our experienced team. Our goal is to create
      cleaner, healthier environments while building lasting trust with customers across the UK.
    </p>
  </section>
</template>

<script lang="ts" setup>
import heroImage from '@/assets/personal-item.jpg'
</script>

<style scoped>
.hero-img-container {
  width: 100%;
  height: 600px;
  position: relative;
}
img.hero-image-asset {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.about-us-header {
  position: absolute;
  bottom: 5%;
  margin: 0;
  padding-left: 3rem;
}
@media (min-width: 769px) {
  section.about-us-text {
    width: 60%;
    margin: 2rem;
  }
}
@media (max-width: 769px) {
  section.about-us-text {
    padding: 10px 18px;
  }
  .hero-img-container {
    width: 100%;
    height: 400px;
  }
}
</style>
