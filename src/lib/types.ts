/** Shared domain types for CloudOps AI. */

export type Status = "healthy" | "warning" | "critical" | "offline";
export type Severity = "critical" | "warning" | "info";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Role = "admin" | "operator" | "viewer";

export const RESOURCE_TYPES = [
  "EC2",
  "Kubernetes Pod",
  "Kubernetes Node",
  "Container",
  "Database",
  "Load Balancer",
  "Server",
] as const;

export const PROVIDERS = ["demo", "aws", "azure", "gcp", "kubernetes"] as const;

export const REGIONS = [
  "ap-south-1",
  "ap-southeast-1",
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
] as const;

export interface Resource {
  id: string;
  environment_id: string;
  name: string;
  resource_type: string;
  provider: string;
  region: string;
  status: string;
  enabled: boolean;
  instance_count: number;
  min_instances: number;
  max_instances: number;
  target_cpu: number;
  target_memory: number;
  hourly_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface MetricPoint {
  resource_id: string;
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network_in: number;
  network_out: number;
  requests: number;
  latency: number;
  error_rate: number;
  connections: number;
  instance_count: number;
}

export interface PredictionResult {
  predicted_load: number;
  confidence: number;
  risk_level: RiskLevel;
  recommended_instances: number;
  reason: string;
  trend: "increasing" | "stable" | "decreasing";
  growth_rate: number;
  moving_average: number;
  risk_score: number;
}

export interface ScalingDecision {
  action: "scale_up" | "scale_down" | "hold";
  previous_instances: number;
  new_instances: number;
  reason: string;
  blocked_by_cooldown: boolean;
}

export interface Anomaly {
  id: string;
  resource_id: string;
  resource_name: string;
  metric: string;
  severity: Severity;
  title: string;
  description: string;
  recommended_action: string;
  detected_at: string;
}

export interface ScalingPolicy {
  id: string;
  resource_id: string;
  min_instances: number;
  max_instances: number;
  target_cpu: number;
  target_memory: number;
  scale_up_cooldown: number;
  scale_down_cooldown: number;
  enabled: boolean;
  updated_at: string;
}

export interface Alert {
  id: string;
  resource_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  acknowledged_by: string | null;
  resolved_by: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface ScalingEvent {
  id: string;
  resource_id: string;
  timestamp: string;
  action: string;
  previous_instances: number;
  new_instances: number;
  reason: string | null;
  trigger: string;
  status: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null;
  status: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  created_at: string;
}
