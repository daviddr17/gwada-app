export type AssistantStreamToolAcc = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** Merge OpenAI/xAI streamed tool_call deltas by index. */
export function accumulateStreamToolCallDelta(
  acc: AssistantStreamToolAcc[],
  deltas: Array<{
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>,
): void {
  for (const d of deltas) {
    const idx = d.index ?? 0;
    const existing = acc[idx];
    if (!existing) {
      acc[idx] = {
        id: d.id ?? "",
        type: "function",
        function: {
          name: d.function?.name ?? "",
          arguments: d.function?.arguments ?? "",
        },
      };
      continue;
    }
    if (d.id) existing.id = d.id;
    if (d.function?.name) existing.function.name += d.function.name;
    if (d.function?.arguments) {
      existing.function.arguments += d.function.arguments;
    }
  }
}
