import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { useAuthStore } from './stores/auth'
import { installErrorReporter } from './plugins/errorReporter'
import { setAnalyticsUser } from './utils/analytics'

import './styles/tailwind.css'
import './styles/layout.css'
import './styles/typography.css'
import './styles/styles.css'

const app = createApp(App)

// Error reporter must be installed before mounting so Vue's errorHandler
// is in place before any component renders.
installErrorReporter(app)

const auth = useAuthStore(pinia)
await auth.init()
auth.bindAuthListener()

// Sync auth state into analytics so page-view events carry user_id
if (auth.userId) setAnalyticsUser(auth.userId)

app.use(pinia)
app.use(router)

app.mount('#app')
