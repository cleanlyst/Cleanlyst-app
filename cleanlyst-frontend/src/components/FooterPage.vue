<template>
  <footer class="footerPage">
    <div class="footerInner">
      <div class="footerColumn brandColumn">
        <router-link :to="{ name: 'Home' }" class="footerBrand">
          <img src="/logo-text.svg" alt="Cleanlyst logo" class="footerLogo" />
        </router-link>

        <div class="socialLinks">
          <a href="#" aria-label="Instagram" class="socialLink">
            <svg
              viewBox="0 0 24 24"
              class="socialIcon"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="5"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
            </svg>
          </a>
          <a href="#" aria-label="Facebook" class="socialLink">
            <svg
              viewBox="0 0 24 24"
              class="socialIcon"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13.5 21V13.2H16.1L16.5 10.2H13.5V8.3C13.5 7.43 13.73 6.84 14.98 6.84H16.6V4.15C16.32 4.11 15.37 4 14.26 4C11.95 4 10.36 5.41 10.36 8V10.2H7.8V13.2H10.36V21H13.5Z"
                fill="currentColor"
              />
            </svg>
          </a>
        </div>
      </div>

      <div class="footerColumn linkColumn">
        <h2 class="footerTitle text-underline">Explore</h2>
        <div class="footerLinks">
          <router-link :to="{ name: 'About' }" class="footerLink">About Us</router-link>
          <router-link :to="{ name: 'Services' }" class="footerLink">Services</router-link>
        </div>
      </div>

      <div class="footerColumn contactColumn">
        <h2 class="footerTitle text-underline">About Us</h2>
        <div class="contactList">
          <a href="tel:+442079460821" class="footerLink">+44 20 7946 0821</a>
          <a href="mailto:hello@cleanlyst.co" class="footerLink">hello@cleanlyst.co</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footerPage {
  background: var(--black);
  color: var(--white);
  padding: 2.5rem 1rem;
}

.footerInner {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 2rem;
}

.footerColumn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 1 0;
}

.footerBrand {
  display: inline-flex;
  align-self: flex-start;
}

.footerLogo {
  height: 100px;
  object-fit: contain;
  filter: invert(1);
}

.footerTitle {
  margin-bottom: 10px;
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.92);
}

.socialLinks {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: center;
}
.contactList,
.footerLinks {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.footerLink,
.socialLink {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
}

.footerLink:hover,
.socialLink:hover {
  color: var(--white);
}

.socialLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;

  border-radius: 999px;
}

.socialIcon {
  width: 18px;
  height: 18px;
}

@media (max-width: 720px) {
  .footerInner {
    flex-direction: row;
    gap: 1.5rem;
  }
}
</style>
