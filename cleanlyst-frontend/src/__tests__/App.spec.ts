import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { pinia } from '../stores'
import App from '../App.vue'

describe('App', () => {
  it('renders the app shell', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
        stubs: ['router-link', 'router-view'],
      },
    })

    expect(wrapper.find('.navbar').exists()).toBe(true)
  })
})
