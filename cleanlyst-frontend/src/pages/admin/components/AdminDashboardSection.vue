<template>
  <div class="overview-container">
    <div class="dashboard-card card-shadow">
      <div class="overview-icons">
        <img :src="logo" alt="" width="30px" height="30px" />
        <img :src="logo" alt="" width="30px" height="30px" />
      </div>
      <div class="overview-content">
        <span>Active Cleaners</span>
        <p class="h6 boldFont">1,284</p>
      </div>
    </div>
    <div class="dashboard-card card-shadow">
      <div class="overview-icons">
        <img :src="logo" alt="" width="30px" height="30px" />
        <img :src="logo" alt="" width="30px" height="30px" />
      </div>
      <div class="overview-content">
        <span>Total Revenue</span>
        <p class="h6 boldFont">£300.7k</p>
      </div>
    </div>
    <div class="dashboard-card card-shadow">
      <div class="overview-icons">
        <img :src="logo" alt="" width="30px" height="30px" />
        <img :src="logo" alt="" width="30px" height="30px" />
      </div>
      <div class="overview-content">
        <span>Customer Growth</span>
        <p class="h6 boldFont">900</p>
      </div>
    </div>
    <div class="dashboard-card card-shadow">
      <div class="overview-icons">
        <img :src="logo" alt="" width="30px" height="30px" />
        <img :src="logo" alt="" width="30px" height="30px" />
      </div>
      <div class="overview-content">
        <span>Pending Approval</span>
        <p class="h6 boldFont">84</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import logo from '@/assets/preferences.png'
</script>

<style scoped>
.overview-container {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
}

.overview-icons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  margin-bottom: 10px;
}
</style>
