<template>
  <main class="terms-page">
    <section class="terms-page__content">
      <h1>Terms of Service</h1>
      <p>
        Cleanlyst terms are being prepared for launch. For questions about using the service,
        contact
        <a href="mailto:support@cleanlyst.app">support@cleanlyst.app</a>.
      </p>
    </section>
  </main>
</template>

<style scoped>
.terms-page {
  min-height: calc(100vh - 8rem);
  padding: 8rem 1.5rem 6rem;
  color: var(--on-surface);
  background: var(--background);
  font-family: var(--font-body);
}

.terms-page__content {
  max-width: 48rem;
  margin: 0 auto;
}

h1 {
  margin: 0 0 1rem;
  color: var(--primary);
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}

p {
  margin: 0;
  color: var(--secondary);
  font-size: 16px;
  line-height: 1.6;
}

a {
  color: var(--primary);
  text-decoration: underline;
}
</style>
