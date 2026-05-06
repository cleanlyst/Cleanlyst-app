<template>
  <main class="page-main">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-bg">
        <div class="hero-overlay"></div>
        <img
          class="hero-img"
          alt="City skyline with a clean, modern aesthetic"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDGJpK8LRbOr5PNdqFenD4PUQDtI0yS-jhm2gIYZEd7G3vNnWPFtkw5i8K00jxehXAIWRl772QlvfY9hMSBMeF1r6WkbqVPqiSlyywM_BBjBfhYuYzYC_37dLZpUn-2OC0jlSNUZtppqAnIuEknkp9W9Kaswh3CMU1adX4uieXG6bZcBLNSFcjZmpTOSbDAF-JFq-8GzL_vPV85yVjzWqQcfBJ5PaGihKw2cSoa1y_NqNltquAtbd-LgwgbeoqFASpauY5X1cl-Q"
        />
      </div>
      <div class="hero-content">
        <h1 class="hero-title">Connecting your city to professional hygiene.</h1>
        <p class="hero-copy">
          A systematic approach to urban cleanliness, built on the foundations of trust and
          professional excellence.
        </p>
      </div>
    </section>
    <!-- Our Mission -->
    <section class="mission-section">
      <div class="container">
        <div class="mission-grid">
          <div>
            <span class="mission-label">Our Mission</span>
            <h2 class="mission-title">
              A reliable, transparent bridge between professionals and residents.
            </h2>
          </div>
          <div class="mission-copy">
            <p class="body-text">
              Cleanlyst was built to solve a fundamental urban challenge: the lack of structural
              reliability in domestic and professional hygiene services. We believe that a pristine
              environment is the foundation of productivity and well-being.
            </p>
            <p class="body-text">
              By leveraging a systematic marketplace model, we provide a transparent platform where
              residents who value quality can connect with vetted professionals who take pride in
              their craft. No noise, no friction—just clean spaces.
            </p>
          </div>
        </div>
      </div>
    </section>
    <!-- Why Choose Us - Bento Grid Style -->
    <section class="pillars-section">
      <div class="container">
        <h2 class="pillars-heading">Three Pillars of Excellence</h2>
        <div class="pillars-grid">
          <!-- Pillar 1 -->
          <div class="pillar-card">
            <div class="pillar-icon-box">
              <span class="material-symbols-outlined" data-icon="verified">verified</span>
            </div>
            <div>
              <h3 class="pillar-title">Vetted Professionals</h3>
              <p class="body-text">
                Every cleaner undergoes a multi-step verification process, ensuring only the most
                reliable talent joins our marketplace ecosystem.
              </p>
            </div>
          </div>
          <!-- Pillar 2 -->
          <div class="pillar-card">
            <div class="pillar-icon-box">
              <span class="material-symbols-outlined" data-icon="calendar_today"
                >calendar_today</span
              >
            </div>
            <div>
              <h3 class="pillar-title">Systematic Scheduling</h3>
              <p class="body-text">
                Our automated booking engine eliminates double-bookings and confusion, providing a
                seamless logistical experience for both parties.
              </p>
            </div>
          </div>
          <!-- Pillar 3 -->
          <div class="pillar-card">
            <div class="pillar-icon-box">
              <span class="material-symbols-outlined" data-icon="payments">payments</span>
            </div>
            <div>
              <h3 class="pillar-title">Transparent Pricing</h3>
              <p class="body-text">
                No hidden fees or complex negotiations. Our standardized pricing model ensures
                clarity and fairness in every transaction.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- Our Story -->
    <section class="story-section">
      <div class="story-container">
        <h2 class="story-title">Our Story</h2>
        <div class="story-content">
          <p>
            Founded with a vision to professionalize the cleaning industry, CleanMarket began as a
            small initiative to support local cleaners in gaining the recognition and stability they
            deserve. We saw the disconnect between high demand for quality and the fragmented supply
            of services.
          </p>
          <p>
            Today, we are more than just a marketplace; we are a community-driven platform committed
            to quality and local support. Our journey is defined by the thousands of pristine spaces
            we've helped create and the professional lives we've helped empower through fair,
            transparent opportunities.
          </p>
        </div>
        <div class="story-footer">
          <button class="cta-button">Join Our Community</button>
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

/* Hero */
.hero-section {
  position: relative;
  height: 614px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #ffffff;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: rgba(9, 9, 11, 0.05);
  z-index: 10;
}

.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  opacity: 0.4;
}

.hero-content {
  position: relative;
  z-index: 20;
  text-align: center;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 56rem;
  margin: 0 auto;
}

.hero-title {
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.025em;
  color: var(--primary);
  margin-bottom: 1.5rem;
}

.hero-copy {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
  max-width: 42rem;
  margin: 0 auto;
}

/* Shared container */
.container {
  max-width: 80rem;
  margin: 0 auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

/* Mission */
.mission-section {
  padding-top: 6rem;
  padding-bottom: 6rem;
  background: #ffffff;
  border-bottom: 1px solid var(--outline-variant);
}

.mission-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4rem;
  align-items: start;
}

.mission-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--primary);
  margin-bottom: 1rem;
  display: block;
}

.mission-title {
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--primary);
  margin-bottom: 2rem;
}

.mission-copy {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.body-text {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
}

/* Pillars */
.pillars-section {
  padding-top: 6rem;
  padding-bottom: 6rem;
  background: #f9f9f9;
}

.pillars-heading {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary);
  margin-bottom: 4rem;
  text-align: center;
}

.pillars-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

.pillar-card {
  padding: 2.5rem;
  background: #ffffff;
  border: 1px solid var(--outline-variant);
  border-radius: 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  transition: box-shadow 200ms ease;
}

.pillar-card:hover {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.pillar-icon-box {
  width: 3rem;
  height: 3rem;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.125rem;
}

.pillar-icon-box .material-symbols-outlined {
  color: #ffffff;
}

.pillar-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

/* Story */
.story-section {
  padding-top: 8rem;
  padding-bottom: 8rem;
  background: #ffffff;
}

.story-container {
  max-width: 48rem;
  margin: 0 auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  text-align: center;
}

.story-title {
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary);
  margin-bottom: 2.5rem;
}

.story-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.625;
  color: var(--secondary);
}

.story-footer {
  margin-top: 4rem;
  padding-top: 4rem;
  border-top: 1px solid #f4f4f5;
}

.cta-button {
  background: var(--primary);
  color: var(--on-primary);
  padding: 1rem 2.5rem;
  border-radius: 0.125rem;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: none;
  cursor: pointer;
  transition: opacity 200ms ease;
}

.cta-button:hover {
  opacity: 0.9;
}

@media (min-width: 768px) {
  .pillars-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .container {
    padding-left: 3rem;
    padding-right: 3rem;
  }

  .mission-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
