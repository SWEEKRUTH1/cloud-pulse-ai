import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { AiCore, useAiCoreSupport } from "@/components/ai-agent/AiCore";

export const Route = createFileRoute("/_authenticated/ai-agent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI Agent — CloudOps AI" },
      {
        name: "description",
        content: "The autonomous intelligence at the center of CloudOps AI infrastructure operations.",
      },
      { property: "og:title", content: "AI Agent — CloudOps AI" },
      {
        property: "og:description",
        content: "A real-time visual representation of the autonomous CloudOps AI infrastructure agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiAgentPage,
});

function AiAgentPage() {
  const { ready, supported, reducedMotion } = useAiCoreSupport();

  return (
    <section className="relative isolate -mx-4 -my-6 min-h-[calc(100dvh-65px)] overflow-hidden bg-[radial-gradient(circle_at_center,var(--color-warning)/0.06_0%,var(--color-background)_57%)] lg:-mx-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-grid)/0.14_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)/0.14_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-6 text-center lg:px-8 lg:pt-8">
        <p className="num text-[10px] font-semibold uppercase text-warning sm:text-xs">AI Agent</p>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100dvh-65px)] w-full max-w-6xl flex-col items-center justify-center px-4 pb-8 pt-12 sm:px-8 sm:pb-10 sm:pt-14">
        <div
          className="relative h-[min(63vh,650px)] min-h-[390px] w-full [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_78%)]"
          aria-label="Interactive three-dimensional AI intelligence core"
        >
          {!ready ? <CoreFallback muted /> : null}
          {ready && supported ? (
            <Suspense fallback={<CoreFallback muted />}>
              <AiCore reducedMotion={reducedMotion} />
            </Suspense>
          ) : null}
          {ready && !supported ? <CoreFallback /> : null}
        </div>

        <div className="relative z-10 -mt-8 text-center sm:-mt-12">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Autonomous Infrastructure Agent</h1>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Monitoring • Predicting • Optimizing</p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-healthy">
            <span className="live-dot size-1.5 rounded-full bg-healthy" aria-hidden="true" />
            <span className="num">AGENT ONLINE</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreFallback({ muted = false }: { muted?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center" role={muted ? undefined : "img"} aria-label={muted ? undefined : "AI intelligence core fallback visual"}>
      <div className="relative size-64 sm:size-80">
        <div className="absolute inset-[8%] rounded-full border border-warning/20" />
        <div className="absolute inset-[18%] rotate-45 rounded-full border border-warning/35" />
        <div className="absolute inset-[28%] rounded-full border border-warning/50 bg-warning/5 shadow-[0_0_80px_var(--color-warning)]" />
        <div className="absolute inset-[39%] rounded-full bg-warning shadow-[0_0_52px_var(--color-warning)]" />
      </div>
    </div>
  );
}