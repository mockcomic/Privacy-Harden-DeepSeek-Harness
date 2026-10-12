/** Enabled inventory configuration still omits the request field. */
import { expect, it } from 'vitest'
import { Config } from '../src/index.ts'

it('accepts enabled true without defining a collector or package list', () => {
  expect(Config({ enabled: true }).enabled).toBe(true)
  expect(Config({}).enabled).toBe(true)
  expect(Config({ enabled: false }).enabled).toBe(false)
})
