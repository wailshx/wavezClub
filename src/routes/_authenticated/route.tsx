import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensureApprovedRequestRole, ensureOwnerAdmin } from "@/lib/admin-gestion-api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/gestion" });
    await ensureOwnerAdmin();
    // Repairs officers approved before the review link wrote the grant to the
    // right table. No-op for everyone who already has their role.
    await ensureApprovedRequestRole();
    return { user: data.user };
  },
  component: () => <Outlet />,
});
