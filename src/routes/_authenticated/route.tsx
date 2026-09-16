import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensureOwnerAdmin } from "@/lib/admin-gestion-api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/gestion" });
    await ensureOwnerAdmin();
    return { user: data.user };
  },
  component: () => <Outlet />,
});
