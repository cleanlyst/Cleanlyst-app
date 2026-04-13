import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { useAuthStore } from './stores/auth'

import '../src/styles/layout.css'
import '../src/styles/typography.css'
import '../src/styles/styles.css'

const app = createApp(App)
const auth = useAuthStore(pinia)

await auth.init()
auth.bindAuthListener()

app.use(pinia)
app.use(router)

app.mount('#app')
