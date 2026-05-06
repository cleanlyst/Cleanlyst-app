<template>
  <main class="page-main">
    <!-- Self View Header -->
    <div class="profile-header">
      <div class="profile-header-text">
        <span class="self-view-badge">Self View Mode</span>
        <h1 class="profile-title">Your Public Profile</h1>
        <p class="profile-subtitle">
          This is how potential clients see your professional profile. Ensure your details and
          portfolio are up to date to increase bookings.
        </p>
      </div>
      <button class="edit-btn">
        <span class="material-symbols-outlined" data-icon="edit">edit</span>
        <span class="edit-btn-label">Edit Profile</span>
      </button>
    </div>

    <!-- Main Bento Layout -->
    <div class="profile-grid">
      <!-- Left Column: Identity & Stats -->
      <div class="profile-left">
        <!-- Profile Card -->
        <div class="card">
          <div class="profile-card-inner">
            <div class="avatar">
              <img
                class="avatar-img"
                alt="Elena Rodriguez – professional profile photo"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIIAwzpjNVGi8XxYjN7SGug4E-gSWoVAk8MbxvDU3W-aHA4RNQ-HpLoOlhwEHllatQY8ijKTSUT1TObxkhHDMqp91TK6Q9x_wkqJLu881Mjpu2kdO8paHmsfoBRcyia_Gifs_CiwyLqfyBb_ffWzYmTEctjWsTNwSFwDmmUo_u34xqGg7XOELj3VWi32cZUju3bEGbahHMdAiTqheIkjFJrqNRyRFsxYitNExlMRDvDZyMt6U5Y-djLeLbgQh47V9SB_UfhDlQCQ"
              />
            </div>
            <h2 class="cleaner-name">Elena Rodriguez</h2>
            <p class="cleaner-title">Elite Residential Specialist</p>
            <div class="rating-row">
              <span
                class="material-symbols-outlined"
                data-icon="star"
                data-weight="fill"
                style="font-variation-settings: 'FILL' 1"
                >star</span
              >
              <span class="rating-label">4.9 (124 reviews)</span>
            </div>
            <div class="stats-grid">
              <div class="stat-cell">
                <span class="stat-value">$45</span>
                <span class="stat-caption">Hourly Rate</span>
              </div>
              <div class="stat-cell">
                <span class="stat-value">850+</span>
                <span class="stat-caption">Jobs Done</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Tags -->
        <div class="card card--spaced">
          <h3 class="section-label">Verification Status</h3>
          <div class="tags-row">
            <span class="tag">ID VERIFIED</span>
            <span class="tag">BACKGROUND CHECKED</span>
            <span class="tag">INSURED</span>
          </div>
        </div>

        <!-- Top Skills -->
        <div class="card">
          <h3 class="section-label section-label--mb">Top Skills</h3>
          <div class="skills-list">
            <div class="skill-row">
              <span class="skill-name">Deep Cleaning</span>
              <span class="material-symbols-outlined skill-icon" data-icon="verified"
                >verified</span
              >
            </div>
            <div class="skill-row">
              <span class="skill-name">Post-Construction</span>
              <span class="material-symbols-outlined skill-icon" data-icon="verified"
                >verified</span
              >
            </div>
            <div class="skill-row">
              <span class="skill-name">Eco-Friendly Products</span>
              <span class="material-symbols-outlined skill-icon" data-icon="verified"
                >verified</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Bio & Portfolio -->
      <div class="profile-right">
        <!-- Bio Section -->
        <div class="card">
          <h2 class="card-heading">About Me</h2>
          <div class="bio-body">
            <p>
              With over 8 years of experience in high-end residential cleaning across the
              metropolitan area, I specialize in transforming living spaces into pristine
              sanctuaries. My approach is systematic and detail-oriented, focusing on
              often-overlooked areas to ensure a comprehensive clean every time.
            </p>
            <p>
              I bring my own professional-grade, eco-friendly supplies and equipment. I am currently
              offering services for weekly, bi-weekly, and one-time deep cleaning projects.
            </p>
          </div>
        </div>

        <!-- Portfolio Bento Grid -->
        <div class="portfolio-wrapper">
          <div class="card card--full-span">
            <h2 class="card-heading">Work Portfolio</h2>
            <div class="portfolio-images">
              <div class="portfolio-item">
                <img
                  class="portfolio-img"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNYkacff3y2KQFIxqPgaHREavoXxq7JevrYKLOxY5JKm77MMOteeUSDskQ87ck1006X6bRuHgB77-aruwO_4FZ3BrzUnCI2ZDvFkAjkXj5f6Z9ri9PnqpHTQFgc1NIIQTct4aNndhOQw8T0a_M2JKAsXWjeA6zE7an7gKH7VnLHWuZGvTUWEkbUEvSTPDO5Kt52RmQ0GqeRBJBD_MW1iRhy9wqznyuVZ_c2tK26zM3MVFyH3FHMxuwXKhJ0kasvjVxTT0uX4zapQ"
                />
              </div>
              <div class="portfolio-item">
                <img
                  class="portfolio-img"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDckkIrIU-UGdsFov575MmG1HpuMh8Z2UEB7xs1its5Z8Y0g5o4gvtdUjP8HeuCmstzNEzK6Zjk-JUOpJFNGj0kqe4sWE1SpHFRJJfD8zZG7phbUs5mrpv3xT2io8X2DDxx1irOEo7hf2vDo6KgwVnTWqL78OGiQwGT7UOYOGtOpBMGTvzTGXajR1wCHeQgGzWUl3jm31CNQoWpbBRuf1rs_FbYXsst8kjEQJ23jCl9SFhNLkDMGXjWdQwUx09L8GzazIc7bf5_YQ"
                />
              </div>
              <div class="portfolio-item portfolio-add">
                <div class="add-photo-inner">
                  <span class="material-symbols-outlined add-photo-icon" data-icon="add_a_photo"
                    >add_a_photo</span
                  >
                  <span class="add-photo-label">Add Photo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Service Coverage -->
        <div class="card">
          <h2 class="card-heading">Service Area</h2>
          <div class="service-map">
            <!-- Placeholder for Map -->
            <div class="map-bg">
              <img
                class="map-img"
                alt="Map of the New York metropolitan service area"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKlrCoRp0vJ5NXJ2btwrTeNhzKInneg7EeLV-IHPrrb1RVASd1Sota3L98cndSNfbVOQf-a2Wbmrh4gYQ8kp9qdJWrvWjgs1e5aW9zj9trmO6LvbLOxH_4M06lOkLUoJ6ADIHtb_fsR7_YmgArOmePn9D-CD28ayE7H7uJg0g0vVmcMCRhRRXgMimAXdZDb4R9z6BsLisX80lUVP-ntH8jLplbbjnW122z7WzSoakG_dVfZ7fLIFn-sSWaIcCRbJ6HIz5kGZ4n4Q"
              />
            </div>
            <div class="map-pin">
              <span class="material-symbols-outlined map-pin-icon" data-icon="location_on"
                >location_on</span
              >
              <p class="map-pin-text">Operating within 15 miles of Wigan Manchester</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* ── Material Symbols ───────────────────────────────────────────── */
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

/* ── Page Root ──────────────────────────────────────────────────── */
.page-main {
  background-color: var(--surface-container-lowest);
  color: var(--on-surface);
  padding-top: 2rem;
  padding-bottom: 96px;
  padding-left: 24px;
  padding-right: 24px;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  font-family: 'Inter', sans-serif;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 48px;
    padding-right: 48px;
  }
}

/* ── Profile Header ─────────────────────────────────────────────── */
.profile-header {
  margin-bottom: 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 768px) {
  .profile-header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.profile-header-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.self-view-badge {
  display: inline-block;
  background-color: var(--surface-container-high);
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 0.125rem;
  border: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

.profile-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--on-surface);
  margin: 0;
}

.profile-subtitle {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface-variant);
  max-width: 42rem;
  margin: 0;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary);
  color: var(--on-primary);
  padding: 12px 32px;
  border-radius: 0.125rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.edit-btn:hover {
  opacity: 0.9;
}

.edit-btn:active {
  transform: scale(0.95);
}

.edit-btn-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

/* ── Profile Grid ───────────────────────────────────────────────── */
.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-grid {
    grid-template-columns: repeat(12, 1fr);
  }
}

.profile-left {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-left {
    grid-column: span 4;
  }
}

.profile-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .profile-right {
    grid-column: span 8;
  }
}

/* ── Card ───────────────────────────────────────────────────────── */
.card {
  background-color: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  padding: 24px;
}

.card--spaced {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Profile Card Inner ─────────────────────────────────────────── */
.profile-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.avatar {
  width: 128px;
  height: 128px;
  margin-bottom: 24px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--outline-variant);
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%);
}

.cleaner-name {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 4px;
}

.cleaner-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface-variant);
  margin: 0 0 16px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  margin-bottom: 24px;
}

.rating-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.stats-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--outline-variant);
  padding-top: 24px;
  gap: 16px;
}

.stat-cell {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
}

.stat-caption {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--on-surface-variant);
}

/* ── Section Label ──────────────────────────────────────────────── */
.section-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
  margin: 0;
}

.section-label--mb {
  margin-bottom: 16px;
}

/* ── Tags ───────────────────────────────────────────────────────── */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 8px;
  background-color: var(--surface-container);
  font-size: 10px;
  font-weight: 700;
  border: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

/* ── Skills ─────────────────────────────────────────────────────── */
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-name {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface);
}

.skill-icon {
  color: var(--primary);
}

/* ── Card Heading ───────────────────────────────────────────────── */
.card-heading {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 24px;
}

/* ── Bio ────────────────────────────────────────────────────────── */
.bio-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface-variant);
}

.bio-body p {
  margin: 0;
}

/* ── Portfolio ──────────────────────────────────────────────────── */
.portfolio-wrapper {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .portfolio-wrapper {
    grid-template-columns: repeat(2, 1fr);
  }
}

.card--full-span {
  background-color: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  padding: 24px;
}

@media (min-width: 768px) {
  .card--full-span {
    grid-column: span 2;
  }
}

.portfolio-images {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .portfolio-images {
    grid-template-columns: repeat(3, 1fr);
  }
}

.portfolio-item {
  aspect-ratio: 1 / 1;
  background-color: var(--surface-container);
  border: 1px solid var(--outline-variant);
  overflow: hidden;
}

.portfolio-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.portfolio-img:hover {
  transform: scale(1.05);
}

.portfolio-add {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.portfolio-add:hover {
  background-color: var(--surface-variant);
}

.add-photo-inner {
  text-align: center;
}

.add-photo-icon {
  font-size: 36px;
  color: var(--on-surface-variant);
  display: block;
}

.add-photo-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  margin-top: 8px;
  color: var(--on-surface);
}

/* ── Service Map ────────────────────────────────────────────────── */
.service-map {
  width: 100%;
  height: 256px;
  background-color: var(--surface-container);
  border: 1px solid var(--outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.map-bg {
  position: absolute;
  inset: 0;
  filter: grayscale(100%);
  opacity: 0.4;
}

.map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-pin {
  position: relative;
  z-index: 10;
  background-color: #ffffff;
  padding: 16px 24px;
  border: 1px solid var(--outline-variant);
  text-align: center;
}

.map-pin-icon {
  font-size: 30px;
  display: block;
  margin-bottom: 8px;
  color: var(--on-surface);
}

.map-pin-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface);
  margin: 0;
}
</style>
