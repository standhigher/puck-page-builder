export type SearchTab = 'order' | 'tracking'

export type TrackingNode = {
  node: string
  description: string
  time: string
  location: string
  country: string
  state: string
  city: string
  street: string
  carrier: string
}

export type RawEvent = {
  stage: string
  sub_status: string
  description: string
  time: string
  location: string
  country: string
  state: string
  city: string
  street: string
}

export type PackageItem = {
  product_id: string
  variant_id: string
  title: string
  variant_title: string
  image_url: string
  quantity: number
}

export type EstimatedDelivery = {
  from: string
  to: string
  source: 'carrier' | 'custom'
  carrier_source?: string
  display_state: 'in_transit' | 'date_updated'
  changed_at?: string
}

export type TrackMilestone = {
  tracking_number: string
  nodeList: TrackingNode[]
  rawEventList?: RawEvent[]
  carrier: string
  package_items: PackageItem[]
  estimated_delivery?: EstimatedDelivery
}

export type AdConfig = {
  image_url: string
  link_url: string
}

export type TrackResponse = {
  order_number: string
  mileStoneList: TrackMilestone[]
  ad_config: AdConfig
  trace_id: string
}

export type TrackQueryContext = {
  type: SearchTab
  orderInput: string
  contactInput: string
  trackingInput: string
}

export type TrackingStepKey = 'ordered' | 'ready' | 'transit' | 'out' | 'delivered'

export type TrackingStep = {
  key: TrackingStepKey
  label: string
  date: string
  done: boolean
  icon: 'check' | 'bag' | 'truck' | 'box'
}

export type ShippingDetailItem = {
  description: string
  time: string
  isLatest: boolean
}

export type ShippingDetailDraft = {
  index: number
  description: string
  time: string
  timestamp: number | null
  hasYear: boolean
}

export type ParsedNodeTime = {
  timestamp: number
  hasYear: boolean
  monthIndex: number
  day: number
  hour: number
  minute: number
}

export type TrackingStatusRecord = {
  status: string
  fallbackStatus?: string
  time: string
}

export type TrackingStatusMapping = {
  stage: string
  subStatus: string
  stepKey: TrackingStepKey
}

export type EstimatedDeliveryDisplay = {
  dateText: string
  fromLabel: string
  toLabel: string
}
