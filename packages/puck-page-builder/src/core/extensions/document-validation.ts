import type { PageDocument } from "../schema/page-document";
import type { ExtensionRegistry } from "./registry";
import type { BlockDefinition, ValidationIssue } from "./types";
import { validateFieldValue } from "./validation";

const coreBlockProps: Readonly<Record<string, readonly string[]>> = {
  "core.text": ["content"],
  "core.image": ["src", "alt"]
};

function supportsTarget(block: BlockDefinition, target: PageDocument["target"]) {
  return block.targets.includes("all") || block.targets.includes(target);
}

function validateBlock(document: PageDocument, index: number, registry: ExtensionRegistry): ValidationIssue[] {
  const block = document.blocks[index]!;
  const path = `blocks[${index}]`;
  const definition = registry.getBlock(block.type);
  const coreProps = coreBlockProps[block.type];
  if (!definition && !coreProps) return [{ path, message: `未注册区块：${block.type}` }];
  if (!definition) {
    return Object.keys(block.props)
      .filter((key) => !coreProps.includes(key))
      .map((key) => ({ path: `${path}.props.${key}`, message: "不允许保存未知字段。" }));
  }

  const issues: ValidationIssue[] = [];
  if (block.version !== definition.version) issues.push({ path: `${path}.version`, message: `区块版本必须为 ${definition.version}。` });
  if (!supportsTarget(definition, document.target)) issues.push({ path, message: `区块不支持 ${document.target} target。` });
  if (definition.variants?.length && !definition.variants.some((variant) => variant.id === block.variant)) issues.push({ path: `${path}.variant`, message: `不支持的 variant：${block.variant}。` });

  const allowedProps = new Set([...Object.keys(definition.defaultProps), ...Object.entries(definition.fields).filter(([, field]) => field.persist !== false).map(([name]) => name)]);
  for (const key of Object.keys(block.props)) {
    if (!allowedProps.has(key)) issues.push({ path: `${path}.props.${key}`, message: "不允许保存未知字段。" });
  }
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.persist === false) continue;
    for (const issue of validateFieldValue(field, block.props[name])) {
      issues.push({ ...issue, path: issue.path ? `${path}.props.${name}.${issue.path}` : `${path}.props.${name}` });
    }
  }
  for (const issue of definition.validate?.(block.props) ?? []) {
    const suffix = issue.path.startsWith("props.") ? issue.path.slice("props.".length) : issue.path;
    issues.push({ ...issue, path: `${path}.props.${suffix}` });
  }

  if (block.binding) {
    const source = registry.getDataSource(block.binding.source);
    if (!source) issues.push({ path: `${path}.binding.source`, message: `未注册数据源：${block.binding.source}` });
    else {
      if (!definition.dataSources?.includes(source.key)) issues.push({ path: `${path}.binding.source`, message: "区块未授权使用此数据源。" });
      for (const issue of source.validateParams?.(block.binding.params ?? {}) ?? []) {
        issues.push({ ...issue, path: issue.path ? `${path}.binding.params.${issue.path}` : `${path}.binding.params` });
      }
    }
  }
  return issues;
}

/**
 * Validates a structurally valid PageDocument against a concrete extension
 * registry. Hosts should use it at draft and publish boundaries after
 * migratePageDocument so unregistered blocks and undeclared props cannot
 * enter persistent storage.
 */
export function validatePageDocumentWithRegistry(document: PageDocument, registry: ExtensionRegistry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (document.templateId && !registry.getTemplate(document.templateId)) issues.push({ path: "templateId", message: `未注册模板：${document.templateId}` });
  if (document.templateId && document.templateVersion !== registry.getTemplate(document.templateId)?.version) issues.push({ path: "templateVersion", message: "模板版本与已注册模板不一致。" });
  document.blocks.forEach((_, index) => issues.push(...validateBlock(document, index, registry)));
  return issues;
}
