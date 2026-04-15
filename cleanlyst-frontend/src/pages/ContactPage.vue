<template>
  <main class="contactPage">
    <section class="contactHero">
      <div class="contactIntro">
        <p class="eyebrow">Contact Cleanlyst</p>
        <h1>We are here to help with bookings, cleaner support, and account questions.</h1>
        <p class="introText">
          If you are planning your first booking or need help with an existing request, reach out
          and we will point you in the right direction.
        </p>
      </div>

      <div class="contactCard">
        <h2>Get in touch</h2>
        <p>Email: hello@cleanlyst.co</p>
        <p>Phone: +44 20 7946 0821</p>
        <p>Hours: Monday to Saturday, 8:00 to 18:00</p>
      </div>
    </section>

    <section class="contactGrid">
      <article class="infoCard">
        <h2>Customer support</h2>
        <p>Questions about booking times, cleaners, availability, or changes to your request.</p>
      </article>
      <article class="infoCard">
        <h2>Cleaner support</h2>
        <p>Help with dashboard access, incoming bookings, and availability management.</p>
      </article>
      <article class="infoCard">
        <h2>General enquiries</h2>
        <p>Partnerships, local expansion, or anything else you would like to discuss with the team.</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.contactPage {
  min-height: calc(100vh - 82px);
  padding: 3rem 1rem 4rem;
  background:
    radial-gradient(circle at top left, rgba(231, 119, 86, 0.22), transparent 28%),
    radial-gradient(circle at bottom right, rgba(16, 35, 61, 0.14), transparent 34%),
    linear-gradient(180deg, #f7f3eb 0%, #f1e8d8 100%);
  color: #13223b;
}

.contactHero,
.contactGrid {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.contactHero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1.5rem;
}

.contactIntro,
.contactCard,
.infoCard {
  border-radius: 28px;
  border: 1px solid rgba(19, 34, 59, 0.08);
  box-shadow: 0 22px 60px rgba(19, 34, 59, 0.08);
}

.contactIntro {
  padding: 3rem;
  background: rgba(255, 252, 246, 0.92);
}

.contactCard {
  padding: 2rem;
  background: linear-gradient(180deg, #10233d 0%, #1b3558 100%);
  color: #f8f4ed;
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cf5d34;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 1;
}

.introText,
.infoCard p,
.contactCard p {
  line-height: 1.7;
}

.introText {
  margin: 1.25rem 0 0;
  color: #41506a;
  max-width: 42rem;
}

.contactCard h2,
.infoCard h2 {
  margin-top: 0;
}

.contactGrid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.infoCard {
  padding: 1.75rem;
  background: rgba(255, 252, 246, 0.9);
}

@media (max-width: 900px) {
  .contactHero,
  .contactGrid {
    grid-template-columns: 1fr;
  }

  .contactIntro,
  .contactCard {
    padding: 2rem;
  }
}
</style>
