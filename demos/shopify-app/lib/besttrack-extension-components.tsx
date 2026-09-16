import type { FieldProps } from "@standhigher/puck-page-builder/extensions";

export function TrackingStatusBlock(props: Record<string, unknown>) {
  const heading = typeof props.heading === "string" ? props.heading : "Shipment update";
  const status = typeof props.status === "string" ? props.status : "In transit";
  return <section aria-label="BestTrack tracking status"><h2>{heading}</h2><p>{status}</p></section>;
}

export function StatusToneField({ value, onChange }: FieldProps) {
  const tone = typeof value === "string" ? value : "calm";
  return <button type="button" onClick={() => onChange(tone === "calm" ? "alert" : "calm")}>状态色：{tone}</button>;
}

export function BestTrackToolbarSlot() {
  return <span>BestTrack 已装配</span>;
}
