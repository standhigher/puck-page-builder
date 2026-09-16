import { type Config, type Data } from "@puckeditor/core";
import type { DemoBlock } from "../../editor/state/types";

export function toDemoPuckData(blocks: DemoBlock[]): Data {
  return {
    root: {},
    content: blocks.map((block) => ({
      type: block.type,
      props: { id: block.id, title: block.title, body: block.body }
    }))
  };
}

export function createDemoPuckConfig(onSelect: (id: string) => void): Config {
  const renderBlock = (kind: string) => (props: { id?: unknown; title?: unknown; body?: unknown }) => {
    const id = typeof props.id === "string" ? props.id : "unknown-block";
    const title = typeof props.title === "string" ? props.title : "Untitled block";
    const body = typeof props.body === "string" ? props.body : "";
    return <section
      aria-label={`Select ${kind} in canvas`}
      className="pb-canvas-block"
      data-block-id={id}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(id);
      }}
      role="button"
      tabIndex={0}
    >
      <p className="pb-canvas-block__eyebrow">{kind}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      {kind === "TrackingForm" ? <button type="button">Track order</button> : null}
    </section>;
  };

  return {
    components: {
      Hero: { render: renderBlock("Hero") },
      TrackingForm: { render: renderBlock("TrackingForm") },
      Text: { render: renderBlock("Text") }
    }
  };
}
