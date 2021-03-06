import { Tracer, Span, SpanKind } from "@opencensus/core";
import {
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLFieldResolver
} from "graphql";

export const openCensusTracer = Symbol("OpenCensus Tracer");
export const openCensusSpanMap = Symbol("OpenCensus Span Map");

export async function openCensusTracingGraphQLMiddleware(
  resolve: GraphQLFieldResolver<any, any, any>,
  parent: unknown,
  args: unknown,
  context: {
    [openCensusTracer]?: Tracer;
    [openCensusSpanMap]?: Map<ResponsePath, Span>;
  },
  info: GraphQLResolveInfo
): Promise<any> {
  const tracer = context[openCensusTracer];
  if (!tracer || !tracer.currentRootSpan) {
    return resolve(parent, args, context, info);
  }

  let span;
  const spanMap = (context[openCensusSpanMap] =
    context[openCensusSpanMap] || new Map());
  const parentSpan = info.path.prev && spanMap.get(info.path.prev);
  if (parentSpan) {
    span = tracer.startChildSpan({
      name: info.fieldName,
      kind: SpanKind.UNSPECIFIED,
      childOf: parentSpan
    });

    const parentId =
      (typeof parent === "object" &&
        parent &&
        typeof (parent as { [key: string]: unknown }).id === "string" &&
        (parent as { id: string }).id) ||
      null;

    if (parentId) {
      span.addAttribute("parentId", parentId);
    }
    span.addAttribute("parentType", info.parentType.toString());
    span.addAttribute("fieldName", info.fieldName);
    span.addAttribute("returnType", info.returnType.toString());
  }

  try {
    return await resolve(parent, args, context, info);
  } finally {
    if (span) span.end();
  }
}
