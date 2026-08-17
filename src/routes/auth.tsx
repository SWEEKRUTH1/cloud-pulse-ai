import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CloudOps AI Console" },
      {
        name: "description",
        content:
          "Sign in to the CloudOps AI console to monitor cloud performance and run predictive auto-scaling.",
      },
      { property: "og:title", content: "Sign in — CloudOps AI Console" },
      {
        property: "og:description",
        content: "Access real-time cloud telemetry, AI forecasts and autonomous scaling controls.",
      },
    ],
  }),
  component: () => (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  ),
});

function AuthPage() {
  const { signIn, signUp, session, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && session) void router.navigate({ to: "/overview" });
  }, [loading, session, router]);

  const submit = async (mode: "in" | "up") => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res =
      mode === "in" ? await signIn(email, password) : await signUp(name, email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (mode === "up") setNotice("Account created. You can sign in now.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">CloudOps AI</p>
            <p className="text-xs text-muted-foreground">Predictive cloud operations</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Predict the load before it arrives.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Stream infrastructure telemetry, forecast workload five minutes ahead, detect anomalies
            as they form and let the engine scale capacity autonomously — with every decision
            explained in plain language.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>• Live CPU, memory, traffic, latency and error-rate telemetry</li>
            <li>• Explainable forecasts with confidence and risk levels</li>
            <li>• Cooldown-protected autonomous scaling with full audit trail</li>
            <li>• Cost analytics and right-sizing recommendations in INR</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Demonstration environment — simulated infrastructure telemetry.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-foreground">Console access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your operations dashboard.
          </p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5 space-y-4">
              <Field label="Work email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <Button className="w-full" disabled={busy} onClick={() => void submit("in")}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-5 space-y-4">
              <Field label="Full name" value={name} onChange={setName} />
              <Field label="Work email" value={email} onChange={setEmail} type="email" />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                hint="Minimum 6 characters"
              />
              <Button className="w-full" disabled={busy} onClick={() => void submit("up")}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create account
              </Button>
            </TabsContent>
          </Tabs>

          {error ? (
            <p className="mt-4 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-4 rounded-md border border-healthy/30 bg-healthy/10 px-3 py-2 text-xs text-healthy">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
