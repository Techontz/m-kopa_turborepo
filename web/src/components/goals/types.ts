import type { BadgeTone } from "@/components/ui/Badge";
import type { Option } from "@/components/ui/SelectBox";

export type GoalStatus = "achieved" | "on_track" | "behind" | "missed" | "upcoming";

export interface Goal {
  id: number;
  title: string;
  scope_type: "company" | "zone" | "branch" | "employee";
  scope_label: string;
  branch_id: number | null;
  zone_id: number | null;
  employee_id: number | null;
  assignee: string | null;
  metric: string;
  metric_label: string;
  is_money: boolean;
  target: number;
  period_type: string;
  period_label: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  progress: { achieved: number; target: number; percent: number; remaining: number; expected_percent: number; status: GoalStatus };
}

export interface GoalOptions {
  metrics: Option[];
  scopes: Option[];
  periods: Option[];
  zones: Option[];
}

export interface GoalDetail {
  goal: Goal;
  series: Array<{ label: string; value: number; cumulative: number; target_line: number }>;
}

export interface GoalReport {
  metric: string;
  metric_label: string;
  is_money: boolean;
  from: string;
  to: string;
  branches: Array<{ branch_id: number; branch: string; actual: number; target: number }>;
  officers: Array<{ employee_id: number; employee: string; branch: string | null; actual: number }>;
  goals: Array<{ id: number; title: string; assignee: string | null; achieved: number; target: number; percent: number; status: GoalStatus }>;
  status_counts: Partial<Record<GoalStatus, number>>;
}

export const STATUS_LABEL: Record<GoalStatus, string> = { achieved: "ACHIEVED", on_track: "ON TRACK", behind: "BEHIND", missed: "MISSED", upcoming: "UPCOMING" };
export const STATUS_TONE: Record<GoalStatus, BadgeTone> = { achieved: "success", on_track: "info", behind: "warning", missed: "danger", upcoming: "default" };

/** Validated two-series palette (live blue for actual, amber for target). */
export const ACTUAL_COLOR = "#3c89da";
export const TARGET_COLOR = "#d97706";
