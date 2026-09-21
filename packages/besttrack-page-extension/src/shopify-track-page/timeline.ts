import { formatTrackingDateLabel, formatTrackingDateTime } from "./i18n/dateTime";
import type { Locale } from "./i18n/locales";
import type {
  EstimatedDelivery,
  EstimatedDeliveryDisplay,
  ParsedNodeTime,
  RawEvent,
  SearchTab,
  ShippingDetailDraft,
  ShippingDetailItem,
  TrackMilestone,
  TrackingNode,
  TrackingStatusMapping,
  TrackingStatusRecord,
  TrackingStep,
  TrackingStepKey,
} from "./pages/home/types";
import type { TrackingPageQueryRequest } from "../tracking-page-runtime";

const DEFAULT_INFO_NODE: TrackingNode = {
  node: 'InfoReceived',
  description: '',
  time: '',
  location: '',
  country: '',
  state: '',
  city: '',
  street: '',
  carrier: '',
}

export function normalizeExternalUrl(url: string) {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return ''
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmedUrl)) return trimmedUrl
  if (trimmedUrl.startsWith('//')) return `https:${trimmedUrl}`
  return `https://${trimmedUrl}`
}

export function getUrlParam(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? ''
}

const baseTrackingSteps: TrackingStep[] = [
  {
    key: 'ordered',
    label: 'Ordered',
    date: 'Aug 7',
    done: true,
    icon: 'check',
  },
  {
    key: 'ready',
    label: 'Order Ready',
    date: 'Aug 8',
    done: false,
    icon: 'bag',
  },
  {
    key: 'transit',
    label: 'In Transit',
    date: 'Aug 9',
    done: false,
    icon: 'truck',
  },
  {
    key: 'out',
    label: 'Out for Delivery',
    date: 'Aug 16',
    done: false,
    icon: 'box',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    date: 'Aug 16',
    done: false,
    icon: 'check',
  },
]

const trackingStatusMappings: TrackingStatusMapping[] = [
  { stage: 'InfoReceived', subStatus: 'InfoReceived', stepKey: 'ordered' },
  { stage: 'InTransit', subStatus: 'InTransit_PickedUp', stepKey: 'ready' },
  { stage: 'InTransit', subStatus: 'InTransit_Other', stepKey: 'transit' },
  { stage: 'InTransit', subStatus: 'InTransit_Departure', stepKey: 'transit' },
  { stage: 'InTransit', subStatus: 'InTransit_Arrival', stepKey: 'transit' },
  { stage: 'InTransit', subStatus: 'InTransit_CustomsProcessing', stepKey: 'transit' },
  { stage: 'InTransit', subStatus: 'InTransit_CustomsReleased', stepKey: 'transit' },
  { stage: 'InTransit', subStatus: 'InTransit_CustomsRequiringInformation', stepKey: 'transit' },
  { stage: 'Expired', subStatus: 'Expired_Other', stepKey: 'transit' },
  { stage: 'AvailableForPickup', subStatus: 'AvailableForPickup_Other', stepKey: 'transit' },
  { stage: 'OutForDelivery', subStatus: 'OutForDelivery_Other', stepKey: 'out' },
  { stage: 'DeliveryFailure', subStatus: 'DeliveryFailure_Other', stepKey: 'out' },
  { stage: 'DeliveryFailure', subStatus: 'DeliveryFailure_NoBody', stepKey: 'out' },
  { stage: 'DeliveryFailure', subStatus: 'DeliveryFailure_Security', stepKey: 'out' },
  { stage: 'DeliveryFailure', subStatus: 'DeliveryFailure_Rejected', stepKey: 'out' },
  { stage: 'DeliveryFailure', subStatus: 'DeliveryFailure_InvalidAddress', stepKey: 'out' },
  { stage: 'Delivered', subStatus: 'Delivered_Other', stepKey: 'delivered' },
]

const subStatusStepMap = new Map<string, TrackingStepKey>(
  trackingStatusMappings.map(({ subStatus, stepKey }) => [subStatus, stepKey]),
)

const stageStepMap = new Map<string, TrackingStepKey>(
  trackingStatusMappings.map(({ stage, stepKey }) => [stage, stepKey]),
)

const legacyNodeStepMap = new Map<string, TrackingStepKey>([
  ['InfoReceived', 'ordered'],
  ['PickedUp', 'ready'],
  ['Departure', 'transit'],
  ['Arrival', 'transit'],
  ['AvailableForPickup', 'transit'],
  ['OutForDelivery', 'out'],
  ['Delivered', 'delivered'],
  ['Returned', 'delivered'],
  ['Returning', 'delivered'],
])

const getStepKeyForStatus = (status?: string | null): TrackingStepKey | null => {
  const normalized = status?.trim() ?? ''
  if (!normalized) return null

  const exactMatch = subStatusStepMap.get(normalized) ?? legacyNodeStepMap.get(normalized)
  if (exactMatch) return exactMatch

  const stage = normalized.split('_')[0]
  return stageStepMap.get(stage) ?? null
}

const getStepKeyForStatusRecord = (record: TrackingStatusRecord) =>
  getStepKeyForStatus(record.status) ??
  (record.fallbackStatus ? getStepKeyForStatus(record.fallbackStatus) : null)

const getStepIndexForStatusRecord = (record: TrackingStatusRecord) => {
  const stepKey = getStepKeyForStatusRecord(record)
  return stepKey ? baseTrackingSteps.findIndex((step) => step.key === stepKey) : -1
}

const buildStepsFromStatusRecords = (records: TrackingStatusRecord[], locale: Locale) => {
  let maxIndex = -1
  records.forEach((record) => {
    const index = getStepIndexForStatusRecord(record)
    if (index > maxIndex) {
      maxIndex = index
    }
  })

  return baseTrackingSteps.map((step, index) => {
    const matchedRecord = records.find((record) => getStepKeyForStatusRecord(record) === step.key)
    const date = matchedRecord ? formatNodeDateLabel(matchedRecord.time, locale) : ''

    return {
      ...step,
      done: maxIndex >= 0 ? index <= maxIndex : step.done,
      date: matchedRecord ? date : '',
    }
  })
}

const buildStepsFromRawEvents = (events: RawEvent[], locale: Locale) =>
  buildStepsFromStatusRecords(
    events.map((event) => ({
      status: event.sub_status || event.stage || '',
      fallbackStatus: event.stage,
      time: event.time,
    })),
    locale,
  )

const buildStepsFromNodes = (nodeList: TrackingNode[], locale: Locale) =>
  buildStepsFromStatusRecords(
    nodeList.map((node) => ({
      status: node.node,
      time: node.time,
    })),
    locale,
  )

const monthIndexMap = new Map<string, number>([
  ['jan', 0],
  ['january', 0],
  ['feb', 1],
  ['february', 1],
  ['mar', 2],
  ['march', 2],
  ['apr', 3],
  ['april', 3],
  ['may', 4],
  ['jun', 5],
  ['june', 5],
  ['jul', 6],
  ['july', 6],
  ['aug', 7],
  ['august', 7],
  ['sep', 8],
  ['sept', 8],
  ['september', 8],
  ['oct', 9],
  ['october', 9],
  ['nov', 10],
  ['november', 10],
  ['dec', 11],
  ['december', 11],
])

const normalizeNodeTime = (time: string) => time.replace(/\s+/g, ' ').trim()

const toParsedNodeTime = ({
  year,
  monthIndex,
  day,
  hourInput,
  minute,
  period,
}: {
  year?: number
  monthIndex: number
  day: number
  hourInput: number
  minute: number
  period: string
}): ParsedNodeTime | null => {
  if (day < 1 || day > 31 || hourInput < 1 || hourInput > 12 || minute < 0 || minute > 59) {
    return null
  }

  let hour = hourInput % 12
  if (period.toLowerCase() === 'pm') {
    hour += 12
  }
  const hasYear = year !== undefined
  const timestamp = Date.UTC(hasYear ? year : 2001, monthIndex, day, hour, minute)
  return { timestamp, hasYear, monthIndex, day, hour, minute }
}

const parseMonthNameTime = (time: string) => {
  const match = time.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) return null

  const [, monthName, dayValue, yearValue, hourValue, minuteValue, period] = match
  const monthIndex = monthIndexMap.get(monthName.toLowerCase())
  if (monthIndex === undefined) return null

  return toParsedNodeTime({
    year: yearValue ? Number(yearValue) : undefined,
    monthIndex,
    day: Number(dayValue),
    hourInput: Number(hourValue),
    minute: Number(minuteValue),
    period,
  })
}

const parseYearFirstMonthNameTime = (time: string) => {
  const match = time.match(/^(\d{4})\s+([a-z]+)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) return null

  const [, yearValue, monthName, dayValue, hourValue, minuteValue, period] = match
  const monthIndex = monthIndexMap.get(monthName.toLowerCase())
  if (monthIndex === undefined) return null

  return toParsedNodeTime({
    year: Number(yearValue),
    monthIndex,
    day: Number(dayValue),
    hourInput: Number(hourValue),
    minute: Number(minuteValue),
    period,
  })
}

const parseNumericDateTime = (time: string) => {
  const match = time.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)
  if (!match) return null

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match
  const year = Number(yearValue)
  const monthIndex = Number(monthValue) - 1
  const day = Number(dayValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return {
    timestamp: Date.UTC(year, monthIndex, day, hour, minute),
    hasYear: true,
    monthIndex,
    day,
    hour,
    minute,
  }
}

const parseNativeDateTime = (time: string) => {
  const isoCandidate =
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(time) && !time.includes('T')
      ? time.replace(' ', 'T')
      : time
  const parsed = Date.parse(isoCandidate)
  if (Number.isNaN(parsed)) return null

  const date = new Date(parsed)
  return {
    timestamp: parsed,
    hasYear: /\d{4}/.test(time),
    monthIndex: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

const getNodeTimeMeta = (time: string): ParsedNodeTime | null => {
  const normalized = normalizeNodeTime(time)
  if (!normalized) return null

  return (
    parseMonthNameTime(normalized) ??
    parseYearFirstMonthNameTime(normalized) ??
    parseNumericDateTime(normalized) ??
    parseNativeDateTime(normalized)
  )
}

const formatNodeTime = (time: string, locale: Locale) =>
  formatTrackingDateTime(normalizeNodeTime(time), locale)

const formatNodeDateLabel = (time: string, locale: Locale) =>
  formatTrackingDateLabel(normalizeNodeTime(time), locale)

export function formatEstimatedDelivery(
  estimatedDelivery?: EstimatedDelivery,
  locale?: Locale,
): EstimatedDeliveryDisplay | null {
  if (!estimatedDelivery || !locale) return null

  const from = estimatedDelivery.from.trim()
  const to = estimatedDelivery.to.trim()
  if (!from || !to) return null

  const dateText =
    from === to
      ? formatTrackingDateLabel(from, locale)
      : `${formatTrackingDateLabel(from, locale)}-${formatTrackingDateLabel(to, locale)}`

  return {
    dateText,
    fromLabel: formatTrackingDateLabel(from, locale),
    toLabel: formatTrackingDateLabel(to, locale),
  }
}

/**
 * Estimated delivery is advisory only.  The carrier date is shown while the
 * shipment is still in transit and the end date has not fallen behind either
 * today or the latest tracking event.  A delivered milestone always wins;
 * both carrier and valid custom estimates follow the same expiry rule.
 */
const getComparisonDateTimestamp = (value: string, now = new Date()) => {
  const normalized = normalizeNodeTime(value)
  if (!normalized) return null

  const dateOnlyMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return Date.UTC(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = getNodeTimeMeta(normalized)
  if (parsed) {
    const year = parsed.hasYear ? new Date(parsed.timestamp).getUTCFullYear() : now.getFullYear()
    return Date.UTC(year, parsed.monthIndex, parsed.day)
  }

  const nativeTimestamp = Date.parse(normalized)
  if (Number.isNaN(nativeTimestamp)) return null
  const date = new Date(nativeTimestamp)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

const getLatestTrackingTimestamp = (milestone: TrackMilestone, now = new Date()) => {
  const times = (milestone.rawEventList?.length
    ? milestone.rawEventList.map((event) => event.time)
    : milestone.nodeList.map((node) => node.time)
  )
    .map((time) => getComparisonDateTimestamp(time, now))
    .filter((timestamp): timestamp is number => timestamp !== null)

  return times.length > 0 ? Math.max(...times) : null
}

const hasActualDelivery = (milestone: TrackMilestone) => {
  const statuses = milestone.rawEventList?.length
    ? milestone.rawEventList.flatMap((event) => [event.sub_status, event.stage])
    : milestone.nodeList.map((node) => node.node)

  return statuses.some((status) => /^delivered(?:_|$)/i.test(status.trim()))
}

export function shouldShowEstimatedDelivery(
  milestone: TrackMilestone | undefined,
  now = new Date(),
) {
  const estimatedDelivery = milestone?.estimated_delivery
  if (!milestone || !estimatedDelivery) return false
  if (hasActualDelivery(milestone)) return false

  const endTimestamp = getComparisonDateTimestamp(estimatedDelivery.to, now)
  if (endTimestamp === null) return false

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const latestTracking = getLatestTrackingTimestamp(milestone, now) ?? today
  return endTimestamp >= Math.max(today, latestTracking)
}

const fixYearBoundary = (
  details: ShippingDetailDraft[],
) => {
  if (details.some((d) => d.hasYear)) return details
  const valid = details.map((d) => d.timestamp).filter((t): t is number => t !== null)
  if (valid.length < 2) return details
  const minTs = Math.min(...valid)
  const maxTs = Math.max(...valid)
  const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
  if (maxTs - minTs <= SIX_MONTHS_MS) return details
  // 跨年场景：距最小值超过 6 个月的时间戳，实际上属于上一年
  return details.map((d) => {
    if (d.timestamp === null || d.timestamp - minTs <= SIX_MONTHS_MS) return d
    return { ...d, timestamp: d.timestamp - ONE_YEAR_MS }
  })
}

const normalizeSyntheticPrefixTimeline = (details: ShippingDetailDraft[], syntheticPrefixLength = 0) => {
  if (syntheticPrefixLength <= 0) return details
  if (details.some((item) => item.hasYear)) return details

  const syntheticDetails = details.slice(0, syntheticPrefixLength)
  const realDetails = details.slice(syntheticPrefixLength)
  const syntheticTimestamps = syntheticDetails
    .map((item) => item.timestamp)
    .filter((timestamp): timestamp is number => timestamp !== null)
  const realTimestamps = realDetails
    .map((item) => item.timestamp)
    .filter((timestamp): timestamp is number => timestamp !== null)
  if (syntheticTimestamps.length === 0 || realTimestamps.length === 0) return details

  const minSyntheticTs = Math.min(...syntheticTimestamps)
  const maxRealTs = Math.max(...realTimestamps)
  if (minSyntheticTs <= maxRealTs) return details

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  if (minSyntheticTs - maxRealTs <= THIRTY_DAYS_MS) return details

  const minRealTs = Math.min(...realTimestamps)
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
  const shiftYears = Math.ceil((minSyntheticTs - minRealTs + 1) / ONE_YEAR_MS)
  return details.map((item, index) => {
    if (index >= syntheticPrefixLength || item.timestamp === null) return item
    return { ...item, timestamp: item.timestamp - shiftYears * ONE_YEAR_MS }
  })
}

const sortShippingDetailsByTime = (details: ShippingDetailDraft[], syntheticPrefixLength = 0) => {
  const adjustedDetails = normalizeSyntheticPrefixTimeline(
    fixYearBoundary(details),
    syntheticPrefixLength,
  )
  const hasTimestamp = adjustedDetails.some((item) => item.timestamp !== null)
  return hasTimestamp
    ? [...adjustedDetails].sort((a, b) => {
        if (a.timestamp === null && b.timestamp === null) {
          return a.index - b.index
        }
        if (a.timestamp === null) {
          return 1
        }
        if (b.timestamp === null) {
          return -1
        }
        return b.timestamp - a.timestamp || a.index - b.index
      })
    : adjustedDetails
}

const buildShippingDetailsFromRecords = (
  records: Array<{ description: string; location: string; time: string }>,
  locale: Locale,
): ShippingDetailItem[] => {
  const filtered = records.filter(
    (record) => record.location.trim() || record.description.trim() || record.time.trim(),
  )
  if (filtered.length === 0) return []

  const rawDetails = filtered.map((record, index) => {
    const timeMeta = getNodeTimeMeta(record.time)
    return {
      index,
      description: [record.location.trim(), record.description.trim()].filter(Boolean).join(', '),
      time: formatNodeTime(record.time, locale),
      timestamp: timeMeta?.timestamp ?? null,
      hasYear: timeMeta?.hasYear ?? false,
    }
  })
  const sortedDetails = sortShippingDetailsByTime(rawDetails)

  return sortedDetails.map((item, index) => ({
    description: item.description,
    time: item.time,
    isLatest: index === 0,
  }))
}

const buildShippingDetails = (nodeList: TrackingNode[], locale: Locale): ShippingDetailItem[] =>
  buildShippingDetailsFromRecords(nodeList, locale)

const hasRawTrackingSignal = (event: RawEvent) =>
  Boolean(
    event.sub_status.trim() ||
    event.location.trim() ||
    event.country.trim() ||
    event.state.trim() ||
    event.city.trim() ||
    event.street.trim() ||
    getStepKeyForStatus(event.stage),
  )

const getSyntheticRawEventPrefixLength = (events: RawEvent[]) => {
  const firstEventStage = events[0]?.stage.trim().toLowerCase()
  if (firstEventStage !== 'order confirmed' && firstEventStage !== 'package picked up') {
    return 0
  }

  let length = 0
  for (const event of events) {
    if (hasRawTrackingSignal(event)) break
    length += 1
  }
  return length
}

const getMilestoneNodeList = (milestone?: TrackMilestone) => {
  const rawNodeList = milestone?.nodeList ?? []
  return rawNodeList.length > 0 ? rawNodeList : [DEFAULT_INFO_NODE]
}

export function buildTrackingStepsFromMilestone(milestone: TrackMilestone | undefined, locale: Locale) {
  const rawEvents = milestone?.rawEventList ?? []
  return rawEvents.length > 0
    ? buildStepsFromRawEvents(rawEvents, locale)
    : buildStepsFromNodes(getMilestoneNodeList(milestone), locale)
}

export function buildShippingDetailsFromMilestone(milestone: TrackMilestone | undefined, locale: Locale) {
  const rawEvents = milestone?.rawEventList ?? []
  return rawEvents.length > 0
    ? buildShippingDetailsFromRawEvents(rawEvents, locale)
    : buildShippingDetails(milestone?.nodeList ?? [], locale)
}

const buildShippingDetailsFromRawEvents = (events: RawEvent[], locale: Locale): ShippingDetailItem[] => {
  const filtered = events.filter(
    (event) => event.location.trim() || event.description.trim() || event.time.trim(),
  )
  if (filtered.length === 0) return []

  const syntheticPrefixLength = getSyntheticRawEventPrefixLength(filtered)
  const rawDetails = filtered.map((event, index) => {
    const timeMeta = getNodeTimeMeta(event.time)
    return {
      index,
      description: [event.location.trim(), event.description.trim()].filter(Boolean).join(', '),
      time: formatNodeTime(event.time, locale),
      timestamp: timeMeta?.timestamp ?? null,
      hasYear: timeMeta?.hasYear ?? false,
    }
  })
  const sortedDetails = sortShippingDetailsByTime(rawDetails, syntheticPrefixLength)

  return sortedDetails.map((item, index) => ({
    description: item.description,
    time: item.time,
    isLatest: index === 0,
  }))
}

export function mergeDisplayValues(previous: string[], next: string[]) {
  const normalizedNext = next.filter(Boolean)
  if (normalizedNext.length === 0) {
    return previous
  }
  const merged = [...normalizedNext]
  previous.forEach((value) => {
    if (!normalizedNext.includes(value)) {
      merged.push(value)
    }
  })
  return merged.slice(0, 3)
}

export function normalizeOrderValue(value: string) {
  return value.trim()
}

export function withCacheBustParam(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_t=${Date.now()}`
}

export function syncTrackingQueryToUrl(type: SearchTab, value: string, contactValue = '') {
  if (typeof window === 'undefined') return

  const normalizedValue = value.trim()
  if (!normalizedValue) return
  const normalizedContactValue = contactValue.trim()

  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.hash.replace(/^#/, ''))
  params.delete('order_number')
  params.delete('tracking_number')
  params.delete('email')
  if (type === 'order') {
    params.set('order_number', normalizedValue)
    if (normalizedContactValue) {
      params.set('email', normalizedContactValue)
    }
  } else {
    params.set('tracking_number', normalizedValue)
  }
  url.hash = params.toString()

  window.history.replaceState(window.history.state, '', url)
}

export type TrackingQueryLocationState = {
  tab: SearchTab
  trackingNumber: string
  orderNumber: string
  email: string
  canAutoQuery: boolean
}

export function readTrackingQueryLocationState(
  search = typeof window === "undefined" ? "" : window.location.search,
  hash = typeof window === "undefined" ? "" : window.location.hash,
): TrackingQueryLocationState {
  const searchParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""))
  const getParam = (key: string) => getUrlParam(searchParams, key) || getUrlParam(hashParams, key)
  const trackingNumber = getParam("tracking_number")
  const orderNumber = normalizeOrderValue(getParam("order_number"))
  const email = getParam("email")
  if (trackingNumber) {
    return { tab: "tracking", trackingNumber, orderNumber: "", email: "", canAutoQuery: true }
  }
  if (orderNumber) {
    return { tab: "order", trackingNumber: "", orderNumber, email, canAutoQuery: Boolean(email) }
  }
  return { tab: "tracking", trackingNumber: "", orderNumber: "", email: "", canAutoQuery: false }
}

export function readTrackingQueryFromLocation(
  search = typeof window === "undefined" ? "" : window.location.search,
  hash = typeof window === "undefined" ? "" : window.location.hash,
): TrackingPageQueryRequest | undefined {
  const state = readTrackingQueryLocationState(search, hash)
  if (!state.canAutoQuery) return undefined
  if (state.tab === "tracking") return { mode: "tracking", trackingNumber: state.trackingNumber }
  return { mode: "order", orderNumber: state.orderNumber, email: state.email }
}
