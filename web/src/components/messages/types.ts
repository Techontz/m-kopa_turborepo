import type { Option } from "@/components/ui/SelectBox";

export interface ConversationSummary {
  id: number;
  type: "direct" | "group" | "branch" | "zone" | "company";
  title: string;
  subtitle: string;
  unread_count: number;
  last_message: { body: string; sender: string; created_at: string } | null;
}

export interface ChatMessage {
  id: number;
  body: string;
  sender_id: number | null;
  sender: string;
  mine: boolean;
  created_at: string;
}

export interface ConversationThread {
  conversation: ConversationSummary & { members: Array<{ id: number; label: string }>; can_post: boolean };
  messages: ChatMessage[];
}

export interface ContactsResponse {
  data: Array<Option & { is_head: boolean }>;
  level: "hq" | "zone" | "branch_head" | "staff";
  can_create_group: boolean;
  audiences: Option[];
}
