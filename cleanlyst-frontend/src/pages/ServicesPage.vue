<script setup lang="ts">
import { SERVICES, SERVICES_HERO_TITLE, SERVICES_HERO_COPY } from '@/utils/services'
</script>

<template>
  <main class="page-main">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-wrapper">
        <h1 class="hero-title">{{ SERVICES_HERO_TITLE }}</h1>
        <p class="hero-copy">{{ SERVICES_HERO_COPY }}</p>
        <div class="hero-divider"></div>
      </div>
    </section>
    <!-- Bento Grid Services -->
    <section class="services-section">
      <div class="services-grid">
        <div
          v-for="service in SERVICES"
          :key="service.slug"
          :class="['service-card', service.span && `service-card--${service.span}`]"
        >
          <div>
            <span class="material-symbols-outlined service-icon">{{ service.icon }}</span>
            <h2 class="service-title">{{ service.title }}</h2>
            <p class="service-description">{{ service.description }}</p>
          </div>
          <router-link
            class="service-link"
            :to="{ name: 'BookCleaner', query: { service: service.slug } }"
          >
            Book This Service
            <span class="material-symbols-outlined link-arrow">arrow_forward</span>
          </router-link>
        </div>
      </div>
    </section>
    <!-- Promotional Banner (Asymmetric Layout) -->
    <section class="promo-section">
      <div class="promo-banner">
        <div class="promo-content">
          <p class="promo-label">Professional Network</p>
          <h2 class="promo-title">Can't find what you're looking for?</h2>
          <p class="promo-copy">
            Our network of cleaners is diverse. We offer bespoke quotes for unique cleaning
            requirements. Get in touch with our support team today.
          </p>
          <div class="promo-actions">
            <router-link class="btn-primary" :to="{ name: 'BookCleaner' }"
              >Request a Quote</router-link
            >
            <a class="btn-outline" href="mailto:support@cleanlyst.app">Contact Support</a>
          </div>
        </div>
        <div class="promo-media">
          <img
            alt="Professional Cleaning Supplies"
            class="promo-img"
            data-alt="A macro shot of a perfectly organized collection of professional cleaning tools and supplies, including microfiber cloths, neutral-colored spray bottles, and soft brushes. The scene is shot in a high-key, minimalist studio with bright, soft directional light casting gentle shadows. The color palette is strictly monochromatic, dominated by whites, light greys, and matte blacks, reflecting a modern and professional aesthetic."
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDp26spW589Zr6HLccfQ4gAwOfTQ8W_AdJjic_wVw-gXM8Lmft_ck81eym4fHyqw1jiuS5FEkfOCs33bZzeR4AQv7AoQQNNyEuATxdldqrq5-4QLbw8RPhWF_NrZdyKFNdTKz8HHulcw8E0aiwL7meqAh9e3VwLrLY1QMMbw3xmK6pR-y4DFZexssGQz3v3Uvt8MufhYOctrY5kdlsLJ8eu4Zl5Bf7dLw-dt6omNy_kAKCEX7kieXV3In9jltDeg96zBZ2qeNvjrw"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

.page-main {
  padding-top: 8rem;
  padding-bottom: 6rem;
}

.hero-section,
.services-section,
.promo-section {
  max-width: 80rem;
  margin: 0 auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.hero-section {
  margin-bottom: 5rem;
  text-align: center;
}

.hero-wrapper {
  max-width: 42rem;
}

.hero-title {
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary);
  margin-bottom: 1rem;
}

.hero-copy {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
  margin-bottom: 2rem;
}

.hero-divider {
  width: 4rem;
  height: 0.25rem;
  background: var(--primary);
  margin-bottom: 3rem;
}

.services-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.service-card {
  border: 1px solid #e4e4e7;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #ffffff;
  transition: border-color 200ms ease;
}

.service-card:hover {
  border-color: var(--primary);
}

.service-icon {
  font-size: 1.875rem;
  margin-bottom: 1.5rem;
  display: block;
  color: var(--primary);
}

.service-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  margin-bottom: 0.5rem;
}

.service-description {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
  margin-bottom: 1.5rem;
}

.service-link {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary);
  display: flex;
  align-items: center;
  text-decoration: none;
}

.service-card:hover .service-link {
  text-decoration: underline;
}

.link-arrow {
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.promo-section {
  margin-top: 6rem;
}

.promo-banner {
  background: #18181b;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

.promo-content {
  padding: 3rem;
}

.promo-label {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  color: #a1a1aa;
}

.promo-title {
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
}

.promo-copy {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: #d4d4d8;
  margin-bottom: 2rem;
  max-width: 28rem;
}

.promo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-primary {
  background: #ffffff;
  color: #18181b;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-primary:hover {
  background: #f4f4f5;
}

.btn-outline {
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

.promo-media {
  width: 100%;
  height: 20rem;
  align-self: stretch;
  position: relative;
  background: #27272a;
}

.promo-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  opacity: 0.6;
}

@media (min-width: 768px) {
  .hero-section {
    text-align: left;
  }

  .services-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .service-card--wide,
  .service-card--full {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .hero-section,
  .services-section,
  .promo-section {
    padding-left: 3rem;
    padding-right: 3rem;
  }

  .services-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .service-card--wide {
    grid-column: span 1;
  }

  .service-card--full {
    grid-column: span 3;
  }

  .promo-banner {
    flex-direction: row;
    align-items: center;
  }

  .promo-content {
    width: 50%;
    padding: 4rem;
  }

  .promo-media {
    width: 50%;
    height: auto;
  }
}
</style>
