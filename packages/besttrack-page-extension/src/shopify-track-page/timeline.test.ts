import { describe, expect, it } from 'vitest'
import type { TrackMilestone } from './pages/home/types'
import {
  buildShippingDetailsFromMilestone,
  buildTrackingStepsFromMilestone,
  mergeDisplayValues,
} from './timeline'

const milestoneWithoutCarrierTimes = {
  tracking_number: 'HA252201148441',
  nodeList: [
    {
      node: 'InfoReceived',
      description: 'Submit Forecast',
      time: null,
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
  ],
  rawEventList: [
    {
      stage: 'Order Confirmed',
      sub_status: '',
      description: 'The order has been placed and confirmed.',
      time: '2026-09-11T00:33:10Z',
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
    {
      stage: '',
      sub_status: '',
      description: 'We are now preparing materials to begin crafting your item.',
      time: '2026-09-12T00:43:10Z',
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
    {
      stage: '',
      sub_status: '',
      description: 'Your item is finished and is moving to our packing department.',
      time: '2026-09-14T00:44:10Z',
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
    {
      stage: '',
      sub_status: '',
      description: "We are inspecting and packing your item to ensure it's ship-ready.",
      time: '2026-09-15T00:45:10Z',
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
    {
      stage: 'InfoReceived',
      sub_status: 'InfoReceived',
      description: 'Submit Forecast',
      time: null,
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
    {
      stage: '',
      sub_status: 'InfoReceived',
      description: 'Create Order',
      time: null,
      location: '',
      country: '',
      state: '',
      city: '',
      street: '',
    },
  ],
  carrier: 'HYE',
  package_items: [],
} as unknown as TrackMilestone

// 此工具只合并第一层查询标识；三条上限和去重规则不适用于当前结果的包裹列表。
describe('mergeDisplayValues', () => {
  it('keeps the newest value first and caps the list at three', () => {
    expect(mergeDisplayValues(['B', 'C'], ['A'])).toEqual(['A', 'B', 'C'])
    expect(mergeDisplayValues(['A', 'B', 'C'], ['D'])).toEqual(['D', 'A', 'B'])
  })

  it('moves a repeated value to the front without duplicating it', () => {
    expect(mergeDisplayValues(['B', 'A', 'C'], ['A'])).toEqual(['A', 'B', 'C'])
  })
})

describe('tracking timeline with incomplete API data', () => {
  it('renders steps when carrier events return time as null', () => {
    const steps = buildTrackingStepsFromMilestone(milestoneWithoutCarrierTimes, 'EN')

    expect(steps).toHaveLength(5)
    expect(steps[0]).toMatchObject({
      key: 'ordered',
      done: true,
      date: '',
    })
  })

  it('renders shipping details when some events return time as null', () => {
    const details = buildShippingDetailsFromMilestone(milestoneWithoutCarrierTimes, 'EN')

    expect(details.length).toBeGreaterThan(0)
    expect(details.some((item) => item.description === 'Submit Forecast')).toBe(true)
    expect(details.some((item) => item.description === 'Create Order')).toBe(true)
    expect(details.some((item) => item.time === '')).toBe(true)
  })
})
