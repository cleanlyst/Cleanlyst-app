import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { pinia } from '../stores'
import App from '../App.vue'
import router from '../router'

describe('App', () => {
  it('renders the app shell', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(wrapper.find('.navbar').exists()).toBe(true)
  })
})
