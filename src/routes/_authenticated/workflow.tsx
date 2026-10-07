import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check, Clock3, Gauge, Play, ShieldCheck, Workflow as WorkflowIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLive } from "@/lib/live-store";

const WORKFLOW_STEPS = [
  { key: "telemetry", label: "Telemetry", detail: "Collect data" },
  { key: "analysis", label: "Analysis", detail: "Process metrics" },
  { key: "anomaly", label: "Anomaly Check", detail: "Detect drift" },
  { key: "prediction", label: "Prediction", detail: "Forecast load" },
  { key: "policy", label: "Policy Check", detail: "Validate guardrails" },
  { key: "decision", label: "Scaling Decision", detail: "Choose action" },
  { key: "action", label: "Action", detail: "Trigger automation" },
  { key: "audit", label: "Audit", detail: "Record outcomes" },
] as const;

type StepState = "waiting" | "running" | "completed" | "failed";

type ExecutionState = "idle" | "running" | "completed" | "failed";

export const Route = createFileRoute("/_authenticated/workflow")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workflow — CloudOps AI" },
      { name: "description", content: "Operational workflow orchestration for telemetry analysis, prediction, and simulated scaling decisions." },
      { property: "og:title", content: "Workflow — CloudOps AI" },
      { property: "og:description", content: "Observe → Analyze → Decide → Act across the CloudOps AI control loop." },
    ],
  }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const { resources, environments, environmentId, paused, autoScaling } = useLive();
  const [executionState, setExecutionState] = useState<ExecutionState>("idle");
  const [stepStates, setStepStates] = useState<StepState[]>(WORKFLOW_STEPS.map(() => "waiting"));
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastExecutedAt, setLastExecutedAt] = useState<string | null>(null);

  const resource = resources[0] ?? null;
  const envName = environments.find((entry) => entry.id === environmentId)?.name ?? "Current environment";

  const finalDecision = useMemo(() => {
    if (!resource) {
      return { action: "hold", reason: "No active resource is available for a decision." };
    }

    const action = resource.decision.action === "scale_up" ? "SCALE UP" : resource.decision.action === "scale_down" ? "SCALE DOWN" : "HOLD";
    return {
      action,
      reason: resource.decision.reason,
      resource: resource.resource.name,
      environment: envName,
    };
  }, [envName, resource]);

  const isRunning = executionState === "running";

  useEffect(() => {
    if (!isRunning || currentStep === null) return;

    if (!resource) {
      setStepStates((state) =>
        state.map((step, index) => (index === currentStep ? "failed" : index < currentStep ? "completed" : "waiting")),
      );
      setExecutionState("failed");
      setErrorMessage("No resource data is available for this workflow execution in the current environment.");
      return;
    }

    setStepStates((state) =>
      state.map((step, index) => {
        if (index < currentStep) return "completed";
        if (index === currentStep) return "running";
        return "waiting";
      }),
    );

    const timer = window.setTimeout(() => {
      setStepStates((state) =>
        state.map((step, index) => (index <= currentStep ? "completed" : step)),
      );

      if (currentStep === WORKFLOW_STEPS.length - 1) {
        setExecutionState("completed");
        setCurrentStep(null);
        setLastExecutedAt(new Date().toISOString());
        return;
      }

      setCurrentStep((previous) => (previous == null ? 0 : previous + 1));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [currentStep, isRunning, resource]);

  const startWorkflow = () => {
    if (isRunning) return;

    setExecutionState("running");
    setErrorMessage(null);
    setLastExecutedAt(new Date().toISOString());
    setStepStates(WORKFLOW_STEPS.map(() => "waiting"));
    setCurrentStep(0);
  };

  const completionVisible = executionState === "completed";

  return (
    <section className="space-y-5">
      <div className="panel overflow-hidden shadow-panel">
        <div className="flex flex-col gap-5 border-b border-border px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="num text-[10px] font-semibold uppercase tracking-[0.2em] text-warning sm:text-xs">WORKFLOW</p>
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-warning">
                SIMULATION MODE
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">Observe → Analyze → Decide → Act</h1>
          </div>

          <Button
            size="sm"
            className="w-full max-w-[220px] gap-2 self-start lg:w-auto"
            disabled={isRunning}
            onClick={startWorkflow}
          >
            <Play className="size-4" />
            {isRunning ? "RUN WORKFLOW" : "RUN WORKFLOW"}
          </Button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1">
              <Clock3 className="size-3.5" />
              {executionState === "completed" ? "Completed" : isRunning ? "Running" : "Waiting"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1">
              <WorkflowIcon className="size-3.5" />
              {autoScaling ? "Autonomous" : "Manual"}
            </span>
            {!paused ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1">
                <ShieldCheck className="size-3.5" />
                Live telemetry
              </span>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3 overflow-x-auto pb-1 md:flex-row md:justify-center md:gap-1.5 md:pb-0">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.key} className="flex w-full max-w-[240px] flex-col items-center justify-center md:max-w-none">
                <div
                  className={cn(
                    "relative w-full rounded-xl border px-3 py-3 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300",
                    stepStates[index] === "completed" && "border-healthy/30 bg-healthy/12 text-healthy",
                    stepStates[index] === "running" && "border-primary/40 bg-primary/12 text-primary",
                    stepStates[index] === "failed" && "border-critical/40 bg-critical/12 text-critical",
                    stepStates[index] === "waiting" && "border-border bg-surface-2 text-muted-foreground",
                  )}
                >
                  <div className="mb-2 flex items-center justify-center">
                    {stepStates[index] === "completed" ? (
                      <span className="grid size-6 place-items-center rounded-full bg-healthy/20 text-healthy">
                        <Check className="size-3.5" />
                      </span>
                    ) : stepStates[index] === "running" ? (
                      <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary">
                        <Gauge className="size-3.5" />
                      </span>
                    ) : stepStates[index] === "failed" ? (
                      <span className="grid size-6 place-items-center rounded-full bg-critical/20 text-critical">
                        <AlertTriangle className="size-3.5" />
                      </span>
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full border border-border bg-background text-muted-foreground">
                        <span className="size-2 rounded-full bg-current/60" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{step.label}</p>
                    <p className="text-[11px] opacity-80">{step.detail}</p>
                  </div>

                  <div className="mt-3 text-left text-[10px] font-medium uppercase tracking-[0.18em]">
                    {stepStates[index] === "waiting" && "WAITING"}
                    {stepStates[index] === "running" && "RUNNING"}
                    {stepStates[index] === "completed" && "COMPLETED"}
                    {stepStates[index] === "failed" && "FAILED"}
                  </div>
                </div>

                {index < WORKFLOW_STEPS.length - 1 ? (
                  <div className="flex h-7 w-px items-center justify-center md:h-px md:w-8">
                    <ArrowRight className={cn("size-3.5 text-border md:rotate-0", stepStates[index] === "completed" && "text-healthy", stepStates[index] === "running" && "text-primary", stepStates[index] === "failed" && "text-critical")} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {errorMessage ? (
            <div className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
              {errorMessage}
            </div>
          ) : null}

          {completionVisible ? (
            <div className="rounded-xl border border-healthy/30 bg-healthy/12 p-4 shadow-inner shadow-healthy/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-healthy">WORKFLOW COMPLETED</p>
                  <p className="mt-1 text-sm text-muted-foreground">Telemetry → Audit complete</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-healthy/30 bg-healthy/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-healthy">
                  SIMULATED
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Telemetry</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Analysis</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Anomaly Check</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Prediction</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Policy Check</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Scaling Decision</span>
                  <span className="font-medium text-healthy">{finalDecision.action}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Action</span>
                  <span className="font-medium text-warning">SIMULATED</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Audit</span>
                  <span className="font-medium text-healthy">✓</span>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Decision:</span> {finalDecision.action} · {finalDecision.reason}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-4 shadow-panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Execution Details</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current resource</p>
              <p className="mt-2 text-sm font-medium text-foreground">{resource?.resource.name ?? "No active resource"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current environment</p>
              <p className="mt-2 text-sm font-medium text-foreground">{envName}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Last execution time</p>
              <p className="mt-2 text-sm font-medium text-foreground">{lastExecutedAt ? new Date(lastExecutedAt).toLocaleString() : "Not started"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Final decision</p>
              <p className="mt-2 text-sm font-medium text-foreground">{finalDecision.action}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Execution status</p>
              <p className="mt-2 text-sm font-medium text-foreground">{errorMessage ? "FAILED" : executionState === "completed" ? "COMPLETED" : isRunning ? "RUNNING" : "WAITING"}</p>
            </div>
          </div>
        </div>

        <div className="panel p-4 shadow-panel">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Decision summary</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Resource</p>
              <p className="mt-1 text-sm font-medium text-foreground">{resource?.resource.name ?? "Unavailable"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current action</p>
              <p className="mt-1 text-sm font-medium text-foreground">{finalDecision.action}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reason</p>
              <p className="mt-1 text-sm text-muted-foreground">{resource?.decision.reason ?? finalDecision.reason}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
