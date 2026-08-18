import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Coins,
  Gauge,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloudOps AI — Predictive Cloud Auto-Scaling" },
      {
        name: "description",
        content:
          "CloudOps AI streams real-time infrastructure telemetry, forecasts workload minutes ahead and scales cloud capacity autonomously with explainable decisions.",
      },
      { property: "og:title", content: "CloudOps AI — Predictive Cloud Auto-Scaling" },
      {
        property: "og:description",
        content:
          "Real-time cloud performance analytics with explainable workload forecasts, anomaly detection and autonomous scaling.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Activity,
    title: "Real-time telemetry",
    text: "CPU, memory, disk, network, traffic, latency and error rate streamed continuously per resource.",
  },
  {
    icon: BrainCircuit,
    title: "Explainable forecasts",
    text: "Workload predicted minutes ahead with confidence, risk level and the numbers behind every call.",
  },
  {
    icon: Gauge,
    title: "Autonomous scaling",
    text: "Policy-bounded scaling with cooldown protection, manual override and a full decision log.",
  },
  {
    icon: Sparkles,
    title: "Scenario simulation",
    text: "Inject traffic spikes, memory leaks, latency storms or outages and watch the loop respond.",
  },
  {
    icon: Coins,
    title: "Cost intelligence",
    text: "Utilisation-aware spend analysis with right-sizing recommendations quantified in INR.",
  },
  {
    icon: ShieldCheck,
    title: "Audited operations",
    text: "Role-based access with every operator action and capacity change recorded for review.",
  },
];

const pipeline = ["Collect", "Analyze", "Detect", "Predict", "Decide", "Scale"];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">CloudOps AI</p>
            <p className="text-[11px] text-muted-foreground">Predictive cloud operations</p>
          </div>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open console <ArrowRight className="size-4" />
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
            <span className="live-dot inline-block size-2 rounded-full bg-healthy" />
            Live telemetry · predictive engine online
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground lg:text-5xl">
            Scale cloud capacity before the traffic arrives.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            CloudOps AI watches your infrastructure second by second, forecasts the next few minutes
            of workload, detects anomalies as they form and adjusts capacity autonomously — with
            every decision explained in plain language and logged for audit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Launch the dashboard <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Create an account
            </Link>
          </div>

          <ol className="mt-12 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {pipeline.map((step, i) => (
              <li key={step} className="panel px-3 py-2.5">
                <span className="num text-[11px] text-muted-foreground">0{i + 1}</span>
                <p className="text-sm font-medium text-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border bg-surface-2/40 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              An operations console, not a chart gallery
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Everything an SRE needs to understand load, act on it and prove what happened.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <article key={f.title} className="panel p-5">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted-foreground">
          <p>CloudOps AI — demonstration environment with simulated infrastructure telemetry.</p>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
