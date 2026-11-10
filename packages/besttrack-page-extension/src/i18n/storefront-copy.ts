import type { Locale } from "./locales";
import { useTrackingRuntime } from "../tracking-runtime";

/** 消费者页写死文案。商家改过的区块标题不走这里。 */
export type StorefrontCopy = {
  translateUpdates: string;
  translateShort: string;
  searching: string;
  shippingDetails: string;
  packageContents: string;
  carrier: string;
  destination: string;
  trackingNumber: string;
  orderNumber: string;
  transitTime: string;
  trackingTimeline: string;
  notAvailable: string;
  destinationUnavailable: string;
  packageContentsUnavailable: string;
  shippingEventsEmpty: string;
  shippingEvents: string;
  reorder: string;
  estDelivery: string;
  estDeliveryHint: string;
  estimatedDelivery: string;
  trackingLabel: string;
  orderLabel: string;
  shipmentProgress: string;
  shipmentProgressUnavailable: string;
  deliveryUnavailable: string;
  ordered: string;
  orderReady: string;
  inTransit: string;
  outForDelivery: string;
  delivered: string;
  shipmentAcceptedAtHub: string;
  orderPlacedAndConfirmed: string;
};

const en: StorefrontCopy = {
  translateUpdates: "Translate updates",
  translateShort: "Translate",
  searching: "Searching...",
  shippingDetails: "Shipping Details",
  packageContents: "Package Contents",
  carrier: "Carrier",
  destination: "Destination",
  trackingNumber: "Tracking number",
  orderNumber: "Order number",
  transitTime: "Transit time",
  trackingTimeline: "Tracking timeline",
  notAvailable: "Not available",
  destinationUnavailable: "Destination details are not available.",
  packageContentsUnavailable: "Package contents are not available for this shipment.",
  shippingEventsEmpty: "Shipping events will appear when the carrier publishes them.",
  shippingEvents: "Shipping events",
  reorder: "Reorder",
  estDelivery: "Est. Delivery",
  estDeliveryHint: "Estimated time may update as tracking progresses.",
  estimatedDelivery: "Estimated delivery",
  trackingLabel: "Tracking",
  orderLabel: "Order",
  shipmentProgress: "Shipment progress",
  shipmentProgressUnavailable: "Shipment progress is temporarily unavailable.",
  deliveryUnavailable: "Delivery details are temporarily unavailable.",
  ordered: "Ordered",
  orderReady: "Order Ready",
  inTransit: "In Transit",
  outForDelivery: "Out for Delivery",
  delivered: "Delivered",
  shipmentAcceptedAtHub: "Shipment accepted at the regional hub",
  orderPlacedAndConfirmed: "The order has been placed and confirmed."
};

const catalogs: Record<Locale, StorefrontCopy> = {
  EN: en,
  "ZH-HANS": {
    translateUpdates: "翻译物流",
    translateShort: "翻译",
    searching: "正在查询...",
    shippingDetails: "物流详情",
    packageContents: "包裹内容",
    carrier: "承运商",
    destination: "目的地",
    trackingNumber: "运单号",
    orderNumber: "订单号",
    transitTime: "运输时长",
    trackingTimeline: "物流时间线",
    notAvailable: "暂无信息",
    destinationUnavailable: "暂无目的地信息。",
    packageContentsUnavailable: "此包裹暂无商品信息。",
    shippingEventsEmpty: "承运商发布物流信息后将显示在这里。",
    shippingEvents: "物流记录",
    reorder: "再次购买",
    estDelivery: "预计送达",
    estDeliveryHint: "预计时间可能随物流进度更新。",
    estimatedDelivery: "预计送达",
    trackingLabel: "运单号",
    orderLabel: "订单号",
    shipmentProgress: "物流进度",
    shipmentProgressUnavailable: "物流进度暂时无法显示。",
    deliveryUnavailable: "配送详情暂时无法显示。",
    ordered: "已下单",
    orderReady: "待发货",
    inTransit: "运输中",
    outForDelivery: "派送中",
    delivered: "已签收",
    shipmentAcceptedAtHub: "货物已在区域转运中心签收",
    orderPlacedAndConfirmed: "订单已下达并确认。"
  },
  FR: {
    translateUpdates: "Traduire le suivi",
    translateShort: "Traduire",
    searching: "Recherche...",
    shippingDetails: "Détails d'expédition",
    packageContents: "Contenu du colis",
    carrier: "Transporteur",
    destination: "Destination",
    trackingNumber: "Numéro de suivi",
    orderNumber: "Numéro de commande",
    transitTime: "Délai de transit",
    trackingTimeline: "Suivi détaillé",
    notAvailable: "Non disponible",
    destinationUnavailable: "Les informations de destination ne sont pas disponibles.",
    packageContentsUnavailable: "Le contenu du colis n'est pas disponible pour cet envoi.",
    shippingEventsEmpty: "Les événements d'expédition apparaîtront lorsque le transporteur les publiera.",
    shippingEvents: "Événements d'expédition",
    reorder: "Commander à nouveau",
    estDelivery: "Livraison estimée",
    estDeliveryHint: "L'heure estimée peut être mise à jour au fil du suivi.",
    estimatedDelivery: "Livraison estimée",
    trackingLabel: "Suivi",
    orderLabel: "Commande",
    shipmentProgress: "Progression de l'envoi",
    shipmentProgressUnavailable: "La progression de l'envoi est temporairement indisponible.",
    deliveryUnavailable: "Les détails de livraison sont temporairement indisponibles.",
    ordered: "Commandée",
    orderReady: "Prête",
    inTransit: "En transit",
    outForDelivery: "En cours de livraison",
    delivered: "Livrée",
    shipmentAcceptedAtHub: "Envoi accepté au centre régional",
    orderPlacedAndConfirmed: "La commande a été passée et confirmée."
  },
  ES: {
    translateUpdates: "Traducir actualizaciones",
    translateShort: "Traducir",
    searching: "Buscando...",
    shippingDetails: "Detalles de envío",
    packageContents: "Contenido del paquete",
    carrier: "Transportista",
    destination: "Destino",
    trackingNumber: "Número de seguimiento",
    orderNumber: "Número de pedido",
    transitTime: "Tiempo de tránsito",
    trackingTimeline: "Línea de tiempo",
    notAvailable: "No disponible",
    destinationUnavailable: "Los detalles de destino no están disponibles.",
    packageContentsUnavailable: "El contenido del paquete no está disponible para este envío.",
    shippingEventsEmpty: "Los eventos de envío aparecerán cuando el transportista los publique.",
    shippingEvents: "Eventos de envío",
    reorder: "Volver a pedir",
    estDelivery: "Entrega est.",
    estDeliveryHint: "El tiempo estimado puede actualizarse a medida que avanza el seguimiento.",
    estimatedDelivery: "Entrega estimada",
    trackingLabel: "Seguimiento",
    orderLabel: "Pedido",
    shipmentProgress: "Progreso del envío",
    shipmentProgressUnavailable: "El progreso del envío no está disponible temporalmente.",
    deliveryUnavailable: "Los detalles de entrega no están disponibles temporalmente.",
    ordered: "Pedido",
    orderReady: "Listo",
    inTransit: "En tránsito",
    outForDelivery: "En reparto",
    delivered: "Entregado",
    shipmentAcceptedAtHub: "Envío aceptado en el centro regional",
    orderPlacedAndConfirmed: "El pedido ha sido realizado y confirmado."
  },
  DE: {
    translateUpdates: "Updates übersetzen",
    translateShort: "Übersetzen",
    searching: "Suche...",
    shippingDetails: "Versanddetails",
    packageContents: "Paketinhalt",
    carrier: "Versanddienst",
    destination: "Ziel",
    trackingNumber: "Sendungsnummer",
    orderNumber: "Bestellnummer",
    transitTime: "Laufzeit",
    trackingTimeline: "Sendungsverlauf",
    notAvailable: "Nicht verfügbar",
    destinationUnavailable: "Zielinformationen sind nicht verfügbar.",
    packageContentsUnavailable: "Paketinhalt ist für diese Sendung nicht verfügbar.",
    shippingEventsEmpty: "Versandereignisse erscheinen, sobald der Versanddienstleister sie veröffentlicht.",
    shippingEvents: "Versandereignisse",
    reorder: "Erneut bestellen",
    estDelivery: "Voraussichtliche Lieferung",
    estDeliveryHint: "Die voraussichtliche Zeit kann sich mit dem Sendungsstatus ändern.",
    estimatedDelivery: "Voraussichtliche Lieferung",
    trackingLabel: "Sendung",
    orderLabel: "Bestellung",
    shipmentProgress: "Sendungsfortschritt",
    shipmentProgressUnavailable: "Der Sendungsfortschritt ist vorübergehend nicht verfügbar.",
    deliveryUnavailable: "Lieferdetails sind vorübergehend nicht verfügbar.",
    ordered: "Bestellt",
    orderReady: "Versandbereit",
    inTransit: "Unterwegs",
    outForDelivery: "In Zustellung",
    delivered: "Zugestellt",
    shipmentAcceptedAtHub: "Sendung im regionalen Hub angenommen",
    orderPlacedAndConfirmed: "Die Bestellung wurde aufgegeben und bestätigt."
  },
  "PT-BR": {
    translateUpdates: "Traduzir atualizações",
    translateShort: "Traduzir",
    searching: "Buscando...",
    shippingDetails: "Detalhes do envio",
    packageContents: "Conteúdo do pacote",
    carrier: "Transportadora",
    destination: "Destino",
    trackingNumber: "Código de rastreio",
    orderNumber: "Número do pedido",
    transitTime: "Tempo de trânsito",
    trackingTimeline: "Linha do tempo",
    notAvailable: "Indisponível",
    destinationUnavailable: "Os detalhes do destino não estão disponíveis.",
    packageContentsUnavailable: "O conteúdo do pacote não está disponível para este envio.",
    shippingEventsEmpty: "Os eventos de envio aparecerão quando a transportadora os publicar.",
    shippingEvents: "Eventos de envio",
    reorder: "Comprar novamente",
    estDelivery: "Entrega prev.",
    estDeliveryHint: "O prazo estimado pode ser atualizado conforme o rastreamento avança.",
    estimatedDelivery: "Entrega prevista",
    trackingLabel: "Rastreamento",
    orderLabel: "Pedido",
    shipmentProgress: "Progresso do envio",
    shipmentProgressUnavailable: "O progresso do envio está temporariamente indisponível.",
    deliveryUnavailable: "Os detalhes da entrega estão temporariamente indisponíveis.",
    ordered: "Pedido feito",
    orderReady: "Pronto",
    inTransit: "Em trânsito",
    outForDelivery: "Saiu para entrega",
    delivered: "Entregue",
    shipmentAcceptedAtHub: "Envio aceito no centro regional",
    orderPlacedAndConfirmed: "O pedido foi realizado e confirmado."
  },
  IT: {
    translateUpdates: "Traduci aggiornamenti",
    translateShort: "Traduci",
    searching: "Ricerca...",
    shippingDetails: "Dettagli di spedizione",
    packageContents: "Contenuto del pacco",
    carrier: "Corriere",
    destination: "Destinazione",
    trackingNumber: "Numero di tracking",
    orderNumber: "Numero ordine",
    transitTime: "Tempo di transito",
    trackingTimeline: "Cronologia spedizione",
    notAvailable: "Non disponibile",
    destinationUnavailable: "I dettagli della destinazione non sono disponibili.",
    packageContentsUnavailable: "Il contenuto del pacco non è disponibile per questa spedizione.",
    shippingEventsEmpty: "Gli eventi di spedizione appariranno quando il corriere li pubblicherà.",
    shippingEvents: "Eventi di spedizione",
    reorder: "Ordina di nuovo",
    estDelivery: "Consegna stimata",
    estDeliveryHint: "L'orario stimato può aggiornarsi con il tracciamento.",
    estimatedDelivery: "Consegna stimata",
    trackingLabel: "Tracking",
    orderLabel: "Ordine",
    shipmentProgress: "Avanzamento spedizione",
    shipmentProgressUnavailable: "L'avanzamento della spedizione è temporaneamente non disponibile.",
    deliveryUnavailable: "I dettagli di consegna sono temporaneamente non disponibili.",
    ordered: "Ordinato",
    orderReady: "Pronto",
    inTransit: "In transito",
    outForDelivery: "In consegna",
    delivered: "Consegnato",
    shipmentAcceptedAtHub: "Spedizione accettata al centro regionale",
    orderPlacedAndConfirmed: "L'ordine è stato effettuato e confermato."
  },
  ID: {
    translateUpdates: "Terjemahkan pembaruan",
    translateShort: "Terjemahkan",
    searching: "Mencari...",
    shippingDetails: "Detail pengiriman",
    packageContents: "Isi paket",
    carrier: "Kurir",
    destination: "Tujuan",
    trackingNumber: "Nomor resi",
    orderNumber: "Nomor pesanan",
    transitTime: "Waktu transit",
    trackingTimeline: "Riwayat pengiriman",
    notAvailable: "Tidak tersedia",
    destinationUnavailable: "Detail tujuan tidak tersedia.",
    packageContentsUnavailable: "Isi paket tidak tersedia untuk pengiriman ini.",
    shippingEventsEmpty: "Peristiwa pengiriman akan muncul setelah kurir memublikasikannya.",
    shippingEvents: "Peristiwa pengiriman",
    reorder: "Pesan lagi",
    estDelivery: "Estimasi tiba",
    estDeliveryHint: "Waktu estimasi dapat berubah seiring pelacakan.",
    estimatedDelivery: "Estimasi pengiriman",
    trackingLabel: "Pelacakan",
    orderLabel: "Pesanan",
    shipmentProgress: "Progres pengiriman",
    shipmentProgressUnavailable: "Progres pengiriman sementara tidak tersedia.",
    deliveryUnavailable: "Detail pengiriman sementara tidak tersedia.",
    ordered: "Dipesan",
    orderReady: "Siap dikirim",
    inTransit: "Dalam perjalanan",
    outForDelivery: "Sedang diantar",
    delivered: "Terkirim",
    shipmentAcceptedAtHub: "Pengiriman diterima di hub regional",
    orderPlacedAndConfirmed: "Pesanan telah dibuat dan dikonfirmasi."
  },
  VI: {
    translateUpdates: "Dịch cập nhật",
    translateShort: "Dịch",
    searching: "Đang tìm kiếm...",
    shippingDetails: "Chi tiết vận chuyển",
    packageContents: "Nội dung kiện hàng",
    carrier: "Đơn vị vận chuyển",
    destination: "Điểm đến",
    trackingNumber: "Mã vận đơn",
    orderNumber: "Mã đơn hàng",
    transitTime: "Thời gian vận chuyển",
    trackingTimeline: "Dòng thời gian",
    notAvailable: "Không có thông tin",
    destinationUnavailable: "Chưa có thông tin điểm đến.",
    packageContentsUnavailable: "Chưa có nội dung kiện hàng cho lô này.",
    shippingEventsEmpty: "Sự kiện vận chuyển sẽ hiển thị khi đơn vị vận chuyển cập nhật.",
    shippingEvents: "Sự kiện vận chuyển",
    reorder: "Mua lại",
    estDelivery: "Dự kiến giao",
    estDeliveryHint: "Thời gian dự kiến có thể thay đổi theo tiến trình vận chuyển.",
    estimatedDelivery: "Thời gian giao dự kiến",
    trackingLabel: "Vận đơn",
    orderLabel: "Đơn hàng",
    shipmentProgress: "Tiến trình vận chuyển",
    shipmentProgressUnavailable: "Tiến trình vận chuyển tạm thời không khả dụng.",
    deliveryUnavailable: "Chi tiết giao hàng tạm thời không khả dụng.",
    ordered: "Đã đặt",
    orderReady: "Sẵn sàng",
    inTransit: "Đang vận chuyển",
    outForDelivery: "Đang giao",
    delivered: "Đã giao",
    shipmentAcceptedAtHub: "Lô hàng đã được tiếp nhận tại trung tâm khu vực",
    orderPlacedAndConfirmed: "Đơn hàng đã được đặt và xác nhận."
  },
  TH: {
    translateUpdates: "แปลการอัปเดต",
    translateShort: "แปล",
    searching: "กำลังค้นหา...",
    shippingDetails: "รายละเอียดการจัดส่ง",
    packageContents: "สินค้าในพัสดุ",
    carrier: "ผู้ให้บริการขนส่ง",
    destination: "ปลายทาง",
    trackingNumber: "หมายเลขพัสดุ",
    orderNumber: "หมายเลขคำสั่งซื้อ",
    transitTime: "ระยะเวลาขนส่ง",
    trackingTimeline: "ไทม์ไลน์การจัดส่ง",
    notAvailable: "ไม่มีข้อมูล",
    destinationUnavailable: "ยังไม่มีรายละเอียดปลายทาง",
    packageContentsUnavailable: "ยังไม่มีรายการสินค้าสำหรับพัสดุนี้",
    shippingEventsEmpty: "เหตุการณ์การจัดส่งจะแสดงเมื่อผู้ให้บริการขนส่งเผยแพร่ข้อมูล",
    shippingEvents: "เหตุการณ์การจัดส่ง",
    reorder: "สั่งอีกครั้ง",
    estDelivery: "กำหนดส่งโดยประมาณ",
    estDeliveryHint: "เวลาโดยประมาณอาจอัปเดตตามสถานะพัสดุ",
    estimatedDelivery: "กำหนดส่งโดยประมาณ",
    trackingLabel: "ติดตามพัสดุ",
    orderLabel: "คำสั่งซื้อ",
    shipmentProgress: "ความคืบหน้าพัสดุ",
    shipmentProgressUnavailable: "ความคืบหน้าพัสดุไม่พร้อมใช้งานชั่วคราว",
    deliveryUnavailable: "รายละเอียดการจัดส่งไม่พร้อมใช้งานชั่วคราว",
    ordered: "สั่งซื้อแล้ว",
    orderReady: "พร้อมส่ง",
    inTransit: "กำลังขนส่ง",
    outForDelivery: "กำลังจัดส่ง",
    delivered: "ส่งถึงแล้ว",
    shipmentAcceptedAtHub: "พัสดุได้รับการรับที่ศูนย์ภูมิภาค",
    orderPlacedAndConfirmed: "คำสั่งซื้อได้รับการยืนยันแล้ว"
  }
};

const englishLabelKeys: Record<string, keyof StorefrontCopy> = {
  "Translate updates": "translateUpdates",
  Translate: "translateShort",
  "Searching...": "searching",
  "Shipping Details": "shippingDetails",
  "Package Contents": "packageContents",
  Carrier: "carrier",
  Destination: "destination",
  "Tracking number": "trackingNumber",
  "Order number": "orderNumber",
  "Transit time": "transitTime",
  "Tracking timeline": "trackingTimeline",
  "Not available": "notAvailable",
  "Destination details are not available.": "destinationUnavailable",
  "Package contents are not available for this shipment.": "packageContentsUnavailable",
  "Shipping events will appear when the carrier publishes them.": "shippingEventsEmpty",
  "Shipping events": "shippingEvents",
  Reorder: "reorder",
  "Est. Delivery": "estDelivery",
  "Estimated time may update as tracking progresses.": "estDeliveryHint",
  "Estimated delivery": "estimatedDelivery",
  Tracking: "trackingLabel",
  Order: "orderLabel",
  "Shipment progress": "shipmentProgress",
  "Shipment progress is temporarily unavailable.": "shipmentProgressUnavailable",
  "Delivery details are temporarily unavailable.": "deliveryUnavailable",
  Ordered: "ordered",
  "Order Ready": "orderReady",
  "In Transit": "inTransit",
  "In transit": "inTransit",
  "Out for Delivery": "outForDelivery",
  "Out for delivery": "outForDelivery",
  Delivered: "delivered",
  "Shipment accepted at the regional hub": "shipmentAcceptedAtHub",
  "The order has been placed and confirmed.": "orderPlacedAndConfirmed"
};

export function trackingCopy(locale: Locale): StorefrontCopy {
  return catalogs[locale] ?? en;
}

export function useTrackingCopy() {
  return trackingCopy(useTrackingRuntime().locale);
}

/** 英文默认文案随当前语言替换；商家改过的标题原样保留。 */
export function localizedConfiguredText(value: string, englishDefault: string, copy: StorefrontCopy) {
  const trimmed = value.trim();
  if (trimmed && trimmed !== englishDefault) return trimmed;
  return localizeKnownLabel(trimmed || englishDefault, copy);
}

export function localizeKnownLabel(label: string, copy: StorefrontCopy) {
  const key = englishLabelKeys[label];
  // 英文保持原文大小写；其它语言才替换默认文案。
  if (!key || copy === catalogs.EN) return label;
  return copy[key];
}
