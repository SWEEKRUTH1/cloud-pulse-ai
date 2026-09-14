/**
 * Cloud provider abstraction.
 *
 *   CloudProvider
 *    ├── SimulatedProvider  (active whenever cloud mode is "demo")
 *    └── AwsProvider        (interface stub — refuses to act without credentials)
 *
 * Simulated scaling only changes rows in this project's own database. It never
 * calls a cloud API, so simulation can never turn into real cloud execution.
 */

export type CloudMode = "demo" | "real";

export interface CollectedCapacity {
  resourceId: string;
  instanceCount: number;
}

export interface ScaleResult {
  ok: boolean;
  /** True when the change happened only inside this application. */
  simulated: boolean;
  message: string;
}

export interface CloudProvider {
  readonly id: string;
  readonly simulated: boolean;
  /** Human readable mode label surfaced in the UI. */
  readonly label: string;
  scale(input: { resourceId: string; from: number; to: number }): Promise<ScaleResult>;
}

export const SimulatedProvider: CloudProvider = {
  id: "simulated",
  simulated: true,
  label: "SIMULATION MODE",
  async scale({ from, to }) {
    return {
      ok: true,
      simulated: true,
      message: `Simulated capacity change ${from} → ${to} instances (no cloud API was called).`,
    };
  },
};

/** Interface stub. Kept deliberately inert until credentials are configured. */
export const AwsProvider: CloudProvider = {
  id: "aws",
  simulated: false,
  label: "AWS (not configured)",
  async scale() {
    return {
      ok: false,
      simulated: false,
      message:
        "Real cloud execution is not configured. Add a verified cloud connection before enabling real mode.",
    };
  },
};

export function providerForMode(mode: string | null | undefined, provider?: string): CloudProvider {
  if (mode !== "real") return SimulatedProvider;
  if (provider === "aws") return AwsProvider;
  return SimulatedProvider;
}
