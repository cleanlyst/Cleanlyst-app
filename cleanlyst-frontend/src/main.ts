import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import '../src/styles/layout.css'
import '../src/styles/typography.css'
import '../src/styles/styles.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
