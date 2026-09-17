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
      className={`bt-storefront__section bt-storefront__section--${kind.toLowerCase()}`}
      data-block-id={id}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(id);
      }}
      role="button"
      tabIndex={0}
    >
      <p className="bt-storefront__eyebrow">{kind}</p>
      {kind === "Hero" ? <h1>{title}</h1> : <h2>{title}</h2>}
      <p>{body}</p>
      {kind === "TrackingForm" ? <div className="bt-storefront__tracking"><div className="bt-storefront__form"><input aria-label="Tracking number" placeholder="Enter tracking number" /><button type="button">Track order</button></div></div> : null}
    </section>;
  };

  return {
    components: {
      Hero: { render: (props) => <div className="bt-storefront"><header className="bt-storefront__header"><span className="bt-storefront__brand">BESTTRACK</span><span className="bt-storefront__link">Help center</span></header>{renderBlock("Hero")(props)}</div> },
      TrackingForm: { render: renderBlock("TrackingForm") },
      Text: { render: renderBlock("Text") }
    }
  };
}
