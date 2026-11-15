export interface ModelInfo {
  id: string;
  display_name: string;
  efforts: string[];
  reasoning: boolean;
}

export interface ModelsResponse {
  configured: boolean;
  default_model: string;
  default_effort: string;
  efforts?: string[];
  models: ModelInfo[];
}

export interface TraceStep {
  id?: string;
  tool: string;
  label: string;
  preview: string;
}

export interface ActiveToolInfo {
  id?: string;
  name: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  steps?: TraceStep[];
  duration_s?: number;
}

export interface AgentStreamEvent {
  type: "started" | "ping" | "status" | "thinking_delta" | "tool_start" | "tool_done" | "text_delta" | "done" | "error";
  id?: string;
  text?: string;
  delta?: string;
  name?: string;
  label?: string;
  preview?: string;
  thinking?: string;
  steps?: TraceStep[];
  request_id?: string | null;
  model?: string;
  duration_s?: number;
  elapsed_s?: number;
  started_at?: number;
  message?: string;
}
