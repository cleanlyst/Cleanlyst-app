import { seedTestData } from './utils'

export default async function globalSetup() {
  await seedTestData()
}
