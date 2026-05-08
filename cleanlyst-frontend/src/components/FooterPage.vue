<template>
  <footer class="app-footer" :class="{ 'app-footer--compact': compact }">
    <div class="app-footer__inner">
      <div class="app-footer__brand">
        <router-link :to="{ name: 'Home' }" class="app-footer__logo"> Cleanlyst </router-link>
        <p class="app-footer__copy">© 2026 cleanlyst.app</p>
      </div>

      <nav v-if="showFooterNav" class="app-footer__nav">
        <router-link :to="{ name: 'About' }" class="app-footer__link"> About Us </router-link>
        <router-link :to="{ name: 'PrivacyPolicy' }" class="app-footer__link">
          Privacy Policy
        </router-link>
      </nav>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showFooterNav = computed(() => route.name !== 'ComingSoon')

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<style scoped>
.app-footer {
  width: 100%;
  padding: 3rem 0;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  background: #fafafa;
  border-top: 1px solid #e4e4e7;
}

.app-footer--compact {
  padding-top: 1.5rem;
  padding-bottom: 1.5rem;
}

.app-footer__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 80rem;
  gap: 2rem;
  padding: 0 1.5rem;
  margin: 0 auto;
}

.app-footer__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.app-footer__logo {
  color: #18181b;
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
}

.app-footer__copy {
  margin: 0;
  color: #71717a;
  text-align: center;
}

.app-footer__nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
}

.app-footer__link {
  color: #71717a;
  text-decoration: none;
  opacity: 1;
  transition:
    color 200ms ease,
    opacity 200ms ease;
}

.app-footer__link:hover {
  color: #18181b;
  opacity: 0.8;
}

.app-footer__link--active {
  color: #18181b;
  text-decoration: underline;
}

:global(.dark) .app-footer {
  background: #18181b;
  border-top-color: #27272a;
}

:global(.dark) .app-footer__logo,
:global(.dark) .app-footer__link--active {
  color: #fafafa;
}

:global(.dark) .app-footer__copy,
:global(.dark) .app-footer__link {
  color: #a1a1aa;
}

:global(.dark) .app-footer__link:hover {
  color: #f4f4f5;
}

@media (min-width: 768px) {
  .app-footer__inner {
    flex-direction: row;
  }

  .app-footer__brand {
    align-items: flex-start;
  }

  .app-footer__copy {
    text-align: left;
  }
}

@media (min-width: 1024px) {
  .app-footer__inner {
    padding-right: 3rem;
    padding-left: 3rem;
  }
}
</style>
