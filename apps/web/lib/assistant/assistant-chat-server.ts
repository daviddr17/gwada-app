import "server-only";

import { ASSISTANT_TOOL_DEFINITIONS } from "@/lib/assistant/assistant-tool-definitions";
import {
  streamAssistantChatTurn,
  type AssistantChatTurnResult,
} from "@/lib/assistant/assistant-chat-stream";

export { ASSISTANT_TOOL_DEFINITIONS };
export {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_MAX_TOOL_ROUNDS,
  clipAssistantHistory,
} from "@/lib/assistant/assistant-chat-limits";
export {
  streamAssistantChatTurn,
  type AssistantChatTurnResult,
} from "@/lib/assistant/assistant-chat-stream";
export { accumulateStreamToolCallDelta } from "@/lib/assistant/assistant-stream-tool-acc";

/** Non-streaming wrapper (tests / callers that need a single result). */
export async function runAssistantChatTurn(
  input: Parameters<typeof streamAssistantChatTurn>[0],
): Promise<AssistantChatTurnResult> {
  return streamAssistantChatTurn(input);
}
