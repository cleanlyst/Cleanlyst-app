<template>
  <main class="page-main">
    <!-- Header Section -->
    <div class="page-header">
      <div>
        <h1 class="header-title">Booking Management</h1>
        <p class="header-copy">
          Monitor and manage service transactions across the platform. Use manual overrides to
          resolve disputes or adjust schedules.
        </p>
      </div>
      <div class="header-actions">
        <button class="btn-outline">
          <span class="material-symbols-outlined">download</span>
          Export CSV
        </button>
        <button class="btn-primary">Manual Booking</button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="tab-group">
        <button class="tab-btn tab-btn--active">All Bookings</button>
        <button class="tab-btn">Pending</button>
        <button class="tab-btn">Active</button>
        <button class="tab-btn">Completed</button>
        <button class="tab-btn">Cancelled</button>
      </div>
      <div class="filter-divider"></div>
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input class="search-input" placeholder="Search by ID, client, or cleaner..." type="text" />
      </div>
    </div>

    <!-- Bookings List -->
    <div class="bookings-list">
      <!-- Row 1: Active Booking -->
      <div class="booking-row">
        <div class="flex-shrink-0">
          <div class="booking-icon-box">
            <span class="material-symbols-outlined">cleaning_services</span>
          </div>
        </div>
        <div class="booking-grid">
          <div>
            <span class="col-label">BOOKING ID</span>
            <span class="col-value">#CM-88219</span>
          </div>
          <div>
            <span class="col-label">CLIENT / CLEANER</span>
            <div class="col-value">Sarah Jenkins</div>
            <div class="col-sub">assigned to Marc R.</div>
          </div>
          <div>
            <span class="col-label">SCHEDULE</span>
            <div class="col-value">Oct 24, 2024</div>
            <div class="col-sub">09:00 AM - 12:00 PM</div>
          </div>
          <div>
            <span class="col-label">STATUS</span>
            <span class="status-badge status-badge--active">Active</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-row btn-row--outline">Modify</button>
          <button class="btn-row btn-row--icon">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      <!-- Row 2: Pending Booking -->
      <div class="booking-row">
        <div class="flex-shrink-0">
          <div class="booking-icon-box">
            <span class="material-symbols-outlined">home_work</span>
          </div>
        </div>
        <div class="booking-grid">
          <div>
            <span class="col-label">BOOKING ID</span>
            <span class="col-value">#CM-88224</span>
          </div>
          <div>
            <span class="col-label">CLIENT / CLEANER</span>
            <div class="col-value">Robert Chen</div>
            <div class="col-sub">Awaiting Assignment</div>
          </div>
          <div>
            <span class="col-label">SCHEDULE</span>
            <div class="col-value">Oct 25, 2024</div>
            <div class="col-sub">02:00 PM - 05:00 PM</div>
          </div>
          <div>
            <span class="col-label">STATUS</span>
            <span class="status-badge status-badge--pending">Pending</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-row btn-row--primary">Assign</button>
          <button class="btn-row btn-row--icon">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      <!-- Row 3: Completed Booking -->
      <div class="booking-row">
        <div class="flex-shrink-0">
          <div class="booking-icon-box">
            <span class="material-symbols-outlined">task_alt</span>
          </div>
        </div>
        <div class="booking-grid">
          <div>
            <span class="col-label">BOOKING ID</span>
            <span class="col-value">#CM-88190</span>
          </div>
          <div>
            <span class="col-label">CLIENT / CLEANER</span>
            <div class="col-value">Emily Watson</div>
            <div class="col-sub">completed by Anna S.</div>
          </div>
          <div>
            <span class="col-label">SCHEDULE</span>
            <div class="col-value">Oct 21, 2024</div>
            <div class="col-sub">Total: 4.5 Hours</div>
          </div>
          <div>
            <span class="col-label">STATUS</span>
            <span class="status-badge status-badge--completed">Completed</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-row btn-row--outline">Invoice</button>
          <button class="btn-row btn-row--icon">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>

      <!-- Row 4: Cancelled Booking -->
      <div class="booking-row booking-row--cancelled">
        <div class="flex-shrink-0">
          <div class="booking-icon-box">
            <span class="material-symbols-outlined">cancel</span>
          </div>
        </div>
        <div class="booking-grid">
          <div>
            <span class="col-label">BOOKING ID</span>
            <span class="col-value">#CM-88156</span>
          </div>
          <div>
            <span class="col-label">CLIENT / CLEANER</span>
            <div class="col-value">James Miller</div>
            <div class="col-sub">N/A</div>
          </div>
          <div>
            <span class="col-label">SCHEDULE</span>
            <div class="col-value">Oct 20, 2024</div>
            <div class="col-sub">User Cancelled</div>
          </div>
          <div>
            <span class="col-label">STATUS</span>
            <span class="status-badge status-badge--cancelled">Cancelled</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-row btn-row--outline">Reopen</button>
          <button class="btn-row btn-row--icon">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Manual Override Section / Sidebar Preview -->
    <div class="overrides-section">
      <div class="overrides-main">
        <h2 class="overrides-heading">System Overrides</h2>
        <div class="info-banner">
          <span class="material-symbols-outlined info-banner__icon">info</span>
          <div>
            <p class="info-banner__title">Global Dispute Protocol</p>
            <p class="info-banner__body">
              Administrative overrides will log the action, timestamp, and operator ID. All manual
              modifications are subject to audit logs.
            </p>
          </div>
        </div>
        <div class="override-grid">
          <button class="override-card">
            <span class="material-symbols-outlined override-card__icon">payments</span>
            <span class="override-card__title">Force Refund</span>
            <span class="override-card__desc"
              >Issue full or partial refunds directly to client wallet.</span
            >
          </button>
          <button class="override-card">
            <span class="material-symbols-outlined override-card__icon">person_search</span>
            <span class="override-card__title">Reassign Cleaner</span>
            <span class="override-card__desc"
              >Manually switch service providers for active bookings.</span
            >
          </button>
        </div>
      </div>

      <div class="activity-sidebar">
        <h3 class="activity-sidebar__heading">Activity Monitor</h3>
        <div class="activity-list">
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div>
              <p class="activity-item__title">#CM-88219 Status Change</p>
              <p class="activity-item__meta">2 minutes ago • Admin: admin_user_01</p>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-dot activity-dot--inactive"></div>
            <div>
              <p class="activity-item__title">New Booking Request #CM-88224</p>
              <p class="activity-item__meta">15 minutes ago • System</p>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-dot activity-dot--inactive"></div>
            <div>
              <p class="activity-item__title">Payment Verified #CM-88190</p>
              <p class="activity-item__meta">1 hour ago • Stripe Integration</p>
            </div>
          </div>
          <div class="activity-footer">
            <button class="activity-footer__btn">View All Audit Logs</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────── */
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

/* ── Page layout ──────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Page header ──────────────────────────────────────────── */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 3rem;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  max-width: 42rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* ── Shared buttons ───────────────────────────────────────── */
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: var(--surface-container-lowest, #ffffff);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-outline:hover {
  background: var(--surface-container, #eeeeee);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}

/* ── Filter bar ───────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.filter-divider {
  display: none;
  width: 1px;
  height: 1.5rem;
  background: var(--outline-variant, #c4c7c7);
  margin: 0 0.5rem;
}

@media (min-width: 1024px) {
  .filter-divider {
    display: block;
  }
}

/* ── Tab group ────────────────────────────────────────────── */
.tab-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-container, #eeeeee);
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.tab-btn {
  padding: 0.375rem 1rem;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--secondary, #5e5e5e);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: color 0.15s ease;
}

.tab-btn:hover {
  color: var(--primary, #000000);
}

.tab-btn--active {
  background: #ffffff;
  color: var(--primary, #000000);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ── Search ───────────────────────────────────────────────── */
.search-wrap {
  position: relative;
  flex-grow: 1;
  max-width: 20rem;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #747878;
  font-size: 20px;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--primary, #000000);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--primary, #000000);
}

.search-input::placeholder {
  color: var(--secondary, #5e5e5e);
}

/* ── Bookings list ────────────────────────────────────────── */
.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Booking row ──────────────────────────────────────────── */
.booking-row {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
  background: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 24px;
  transition: box-shadow 0.15s ease;
}

.booking-row:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

@media (min-width: 1024px) {
  .booking-row {
    flex-direction: row;
    align-items: center;
  }
}

.booking-row--cancelled {
  opacity: 0.7;
}

/* ── Booking icon box ─────────────────────────────────────── */
.booking-icon-box {
  width: 3rem;
  height: 3rem;
  background: var(--surface-variant, #e2e2e2);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: var(--primary, #000000);
  flex-shrink: 0;
}

/* ── Booking grid ─────────────────────────────────────────── */
.booking-grid {
  flex-grow: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  width: 100%;
}

@media (min-width: 768px) {
  .booking-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .booking-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ── Column typography ────────────────────────────────────── */
.col-label {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
  display: block;
  margin-bottom: 0.25rem;
}

.col-value {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.col-sub {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

/* ── Status badge ─────────────────────────────────────────── */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  background: #f4f4f5;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.status-badge--active {
  color: #27272a;
}

.status-badge--pending {
  color: #71717a;
}

.status-badge--completed {
  color: #27272a;
}

.status-badge--cancelled {
  color: #a1a1aa;
}

/* ── Row actions ──────────────────────────────────────────── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.btn-row--outline {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-row--outline:hover {
  background: var(--surface-container, #eeeeee);
}

.btn-row--primary {
  padding: 0.375rem 0.75rem;
  border: none;
  background: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-primary, #ffffff);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-row--primary:hover {
  opacity: 0.9;
}

.btn-row--icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: var(--secondary, #5e5e5e);
  cursor: pointer;
  transition: color 0.15s ease;
}

.btn-row--icon:hover {
  color: var(--primary, #000000);
}

/* ── Overrides section ────────────────────────────────────── */
.overrides-section {
  margin-top: 4rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .overrides-section {
    grid-template-columns: repeat(3, 1fr);
  }
}

.overrides-main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .overrides-main {
    grid-column: span 2;
  }
}

.overrides-heading {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0;
}

/* ── Info banner ──────────────────────────────────────────── */
.info-banner {
  background: var(--surface-container, #eeeeee);
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.info-banner__icon {
  color: var(--primary, #000000);
  padding-top: 0.125rem;
  flex-shrink: 0;
}

.info-banner__title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
}

.info-banner__body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Override grid ────────────────────────────────────────── */
.override-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .override-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ── Override card ────────────────────────────────────────── */
.override-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.override-card:hover {
  border-color: var(--primary, #000000);
}

.override-card__icon {
  margin-bottom: 1rem;
  color: var(--primary, #000000);
}

.override-card__title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin-bottom: 0.25rem;
}

.override-card__desc {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

/* ── Activity sidebar ─────────────────────────────────────── */
.activity-sidebar {
  background: var(--surface-container-low, #f3f3f3);
  padding: 24px;
  border: 1px solid var(--outline-variant, #c4c7c7);
}

.activity-sidebar__heading {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  margin: 0 0 1.5rem;
}

/* ── Activity list ────────────────────────────────────────── */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Activity item ────────────────────────────────────────── */
.activity-item {
  display: flex;
  gap: 1rem;
}

.activity-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--primary, #000000);
  margin-top: 0.375rem;
  flex-shrink: 0;
}

.activity-dot--inactive {
  background: var(--outline-variant, #c4c7c7);
}

.activity-item__title {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--primary, #000000);
  margin: 0 0 0.125rem;
}

.activity-item__meta {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Activity footer ──────────────────────────────────────── */
.activity-footer {
  padding-top: 1rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
}

.activity-footer__btn {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  background: transparent;
  border: none;
  cursor: pointer;
}

.activity-footer__btn:hover {
  text-decoration: underline;
}
</style>
