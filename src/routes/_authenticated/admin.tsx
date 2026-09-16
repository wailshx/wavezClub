import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, LEVELS, SPECIALITIES, initials, type Level } from "@/lib/club";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Member console — Wavez" },
      { name: "description", content: "Manage Wavez club members, levels and departments." },
      { property: "og:title", content: "Member console — Wavez" },
      { property: "og:description", content: "Wavez club officers manage member records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Member = {
  id: string;
  full_name: string;
  age: number;
  email: string;
  phone: string;
  speciality: string;
  level: Level;
  department: string;
  status: string;
  created_at: string;
};

type Post = {
  id: string;
  kind: "event" | "news";
  title: string;
  body: string;
  location: string | null;
  event_date: string | null;
  published: boolean;
  created_at: string;
};

const blankPost: Post = {
  id: "",
  kind: "event",
  title: "",
  body: "",
  location: "",
  event_date: null,
  published: true,
  created_at: "",
};

const levelTint: Record<Level, string> = {
  L1: "bg-lilac/30 text-lilac-foreground",
  L2: "bg-blossom/25 text-blossom-foreground",
  L3: "bg-lemon/40 text-lemon-foreground",
  M1: "bg-mint/30 text-mint-foreground",
  M2: "bg-brand/20 text-brand-deep",
};

const controlClass =
  "clay-sm rounded-2xl bg-background px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-brand";
const fieldClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState("all");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [postDraft, setPostDraft] = useState<Post | null>(null);

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      return Boolean(data);
    },
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not remove this member"),
  });

  const saveMember = useMutation({
    mutationFn: async (member: Member) => {
      const { error } = await supabase
        .from("members")
        .update({
          full_name: member.full_name,
          age: member.age,
          email: member.email,
          phone: member.phone,
          speciality: member.speciality,
          level: member.level,
          department: member.department,
          status: member.status,
        })
        .eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member updated");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not save changes"),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-posts"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const savePost = useMutation({
    mutationFn: async (post: Post) => {
      const payload = {
        kind: post.kind,
        title: post.title.trim(),
        body: post.body.trim(),
        location: post.location?.trim() ? post.location.trim() : null,
        event_date: post.event_date ? new Date(post.event_date).toISOString() : null,
        published: post.published,
      };
      if (!payload.title) throw new Error("title required");
      const { error } = post.id
        ? await supabase.from("posts").update(payload).eq("id", post.id)
        : await supabase.from("posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post saved");
      setPostDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
    },
    onError: () => toast.error("Could not save this post"),
  });

  const removePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
    },
    onError: () => toast.error("Could not delete this post"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      if (level !== "all" && member.level !== level) return false;
      if (department !== "all" && member.department !== department) return false;
      if (!term) return true;
      return (
        member.full_name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.phone.toLowerCase().includes(term)
      );
    });
  }, [members, level, department, search]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (roleLoading) {
    return <div className="grid min-h-screen place-items-center font-bold">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <div className="clay-lg max-w-md rounded-3xl bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Not a club officer</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            This account doesn't have admin access to the member list.
          </p>
          <button
            onClick={signOut}
            className="clay-sm mt-6 rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="clay-lg rounded-3xl bg-card p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
                Admin dashboard
              </p>
              <h1 className="font-display text-2xl font-bold">Member management</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="clay-sm rounded-2xl bg-background px-5 py-2.5 text-sm font-bold">
                View site
              </Link>
              <button
                onClick={signOut}
                className="clay-sm rounded-2xl bg-brand-deep px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="clay-sm rounded-2xl bg-background p-4">
              <p className="font-display text-2xl font-bold text-brand-deep">{members.length}</p>
              <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                Total
              </p>
            </div>
            {LEVELS.map((lvl) => (
              <div key={lvl} className="clay-sm rounded-2xl bg-background p-4">
                <p className="font-display text-2xl font-bold">
                  {members.filter((m) => m.level === lvl).length}
                </p>
                <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                  {lvl}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={controlClass}>
              <option value="all">All levels</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={controlClass}
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className={`${controlClass} w-56 font-semibold`}
            />
          </div>

          <div className="clay-sm mt-6 overflow-x-auto rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background text-left text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Level</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Speciality</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center font-semibold text-muted-foreground">
                      Loading members…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center font-semibold text-muted-foreground">
                      No members match these filters yet.
                    </td>
                  </tr>
                )}
                {filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-background/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-brand/20 text-xs font-bold text-brand-deep">
                          {initials(member.full_name)}
                        </span>
                        <span>
                          <span className="font-bold text-foreground">{member.full_name}</span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {member.email} · {member.phone} · {member.age} yrs
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${levelTint[member.level]}`}
                      >
                        {member.level}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold">{member.department}</td>
                    <td className="px-5 py-3.5 font-semibold">{member.speciality}</td>
                    <td className="space-x-2 px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(member)}
                        className="clay-sm rounded-lg bg-lemon/40 px-3 py-1.5 text-xs font-bold text-lemon-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${member.full_name} from the club?`)) {
                            removeMember.mutate(member.id);
                          }
                        }}
                        className="clay-sm rounded-lg bg-blossom/25 px-3 py-1.5 text-xs font-bold text-blossom-foreground"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-5 py-10">
          <div className="clay-lg w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-7">
            <h2 className="font-display text-xl font-bold">Edit member</h2>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMember.mutate(editing);
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Name</label>
                <input
                  className={fieldClass}
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Age</label>
                <input
                  type="number"
                  className={fieldClass}
                  value={editing.age}
                  onChange={(e) => setEditing({ ...editing, age: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Phone</label>
                <input
                  className={fieldClass}
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Email</label>
                <input
                  type="email"
                  className={fieldClass}
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Level</label>
                <select
                  className={fieldClass}
                  value={editing.level}
                  onChange={(e) => setEditing({ ...editing, level: e.target.value as Level })}
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">Status</label>
                <select
                  className={fieldClass}
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Speciality
                </label>
                <select
                  className={fieldClass}
                  value={editing.speciality}
                  onChange={(e) => setEditing({ ...editing, speciality: e.target.value })}
                >
                  {SPECIALITIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Department
                </label>
                <select
                  className={fieldClass}
                  value={editing.department}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                >
                  {DEPARTMENTS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saveMember.isPending}
                  className="clay-md rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground disabled:opacity-70"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="clay-sm rounded-2xl bg-background px-6 py-3 font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
