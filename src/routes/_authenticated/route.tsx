import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Shell, MobileNav } from "@/components/layout/Shell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LiveProvider } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <AuthProvider>
      <LiveProvider>
        <Shell>
          <Outlet />
        </Shell>
        <MobileNav />
        <Toaster />
      </LiveProvider>
    </AuthProvider>
  );
}
