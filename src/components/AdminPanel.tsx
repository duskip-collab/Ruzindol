import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Copy, Check, Shield, MapPin, UserCog, Trash2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRole } from "@/hooks/useCurrentUser";
import { Input } from "@/components/ui/input";

type CodeRole = "Sused" | "Uradnik" | "Starosta" | "Farar";

type InviteRow = {
  id: string;
  code: string;
  created_by: string | null;
  role: CodeRole;
  municipality_id: string | null;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  shared_at: string | null;
  shared_via: string | null;
};

type Muni = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  mayor_name: string | null;
  logo_url: string | null;
};
type UserRow = { id: string; name: string; role: ProfileRole };
type ProfileNameRow = { id: string; name: string | null };

const ROLE_CHOICES: ProfileRole[] = ["Sused", "Starosta", "Uradnik", "Farar", "VIP_Firma"];
const CODE_ROLES: CodeRole[] = ["Sused", "Uradnik", "Starosta", "Farar"];

function randomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    if (i === 4) out += "-";
    else out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function AdminPanel({ adminId, isSuperAdmin }: { adminId: string; isSuperAdmin: boolean }) {
  return (
    <div className="w-full rounded-3xl border-2 border-indigo-300/60 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-400/30 dark:from-indigo-500/10 dark:to-transparent xl:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Administrácia používateľov
          </h3>
          <p className="text-[11px] text-neutral-500">
            Starosta aj Admin môžu spravovať roly susedov.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <RoleAssigner />
        <InviteCodeManager adminId={adminId} />
        {isSuperAdmin && <MunicipalityManager />}
      </div>
    </div>
  );
}

// ---------- Invite codes ----------

function InviteCodeManager({ adminId }: { adminId: string }) {
  const [codes, setCodes] = useState<InviteRow[]>([]);
  const [munis, setMunis] = useState<Muni[]>([]);
  const [users, setUsers] = useState<Record<string, { name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [role, setRole] = useState<CodeRole>("Sused");
  const [muniId, setMuniId] = useState<string>("");
  const [filterRole, setFilterRole] = useState<"all" | CodeRole>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "used" | "shared" | "free">("all");

  const load = async () => {
    setLoading(true);
    const [{ data: mData }, { data: cData }] = await Promise.all([
      supabase
        .from("municipalities")
        .select("id, slug, name, region, mayor_name, logo_url")
        .order("name"),
      supabase
        .from("invite_codes")
        .select("id, code, created_by, role, municipality_id, created_at, used_by, used_at, shared_at, shared_via")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const muniList = (mData as Muni[] | null) ?? [];
    setMunis(muniList);
    if (!muniId && muniList.length > 0) {
      const rz = muniList.find((m) => m.slug === "ruzindol") ?? muniList[0];
      setMuniId(rz.id);
    }
    const rows = (cData as InviteRow[] | null) ?? [];
    setCodes(rows);

    // Resolve used_by → profile name
    const ids = Array.from(
      new Set(rows.flatMap((r) => [r.used_by, r.created_by]).filter(Boolean)),
    ) as string[];
    if (ids.length) {
      const { data: pData } = await supabase.from("profiles").select("id, name").in("id", ids);
      const map: Record<string, { name: string }> = {};
      (pData as ProfileNameRow[] | null)?.forEach((p) => {
        map[p.id] = { name: p.name ?? "Sused" };
      });
      setUsers(map);
    } else {
      setUsers({});
    }
    setLoading(false);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(n = 1) {
    setBusy(true);
    setErr(null);
    const rows = Array.from({ length: n }, () => ({
      code: randomCode(),
      created_by: adminId,
      municipality_id: muniId || null,
      role,
    }));
    const { error } = await supabase.from("invite_codes").insert(rows);
    setBusy(false);
    if (error) return setErr(error.message);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Vymazať tento kód?")) return;
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) return setErr(error.message);
    await load();
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const muniName = (id: string | null) =>
    id ? (munis.find((m) => m.id === id)?.name ?? "—") : "—";

  const filtered = useMemo(
    () =>
      codes.filter((c) => {
        if (filterRole !== "all" && c.role !== filterRole) return false;
        const used = !!c.used_by;
        const shared = !!c.shared_at;
        if (filterStatus === "used" && !used) return false;
        if (filterStatus === "shared" && (!shared || used)) return false;
        if (filterStatus === "free" && (used || shared)) return false;
        return true;
      }),
    [codes, filterRole, filterStatus],
  );

  function codeStatus(c: InviteRow) {
    if (c.used_by) return "used" as const;
    if (c.shared_at) return "shared" as const;
    return "free" as const;
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Generovanie pozvánok
      </h4>

      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
        <label className="col-span-1 text-[11px]">
          <span className="mb-0.5 block text-neutral-500 dark:text-neutral-400">Rola</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CodeRole)}
            className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {CODE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-1 text-[11px]">
          <span className="mb-0.5 block text-neutral-500 dark:text-neutral-400">Obec</span>
          <select
            value={muniId}
            onChange={(e) => setMuniId(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {munis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex gap-1.5">
          <button
            onClick={() => generate(1)}
            disabled={busy || !muniId}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> 1 kód
          </button>
          <button
            onClick={() => generate(10)}
            disabled={busy || !muniId}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600/80 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> 10 kódov
          </button>
          <button
            onClick={() => generate(50)}
            disabled={busy || !muniId}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-500 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> 50 kódov
          </button>
        </div>
      </div>

      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}

      <div className="mb-2 flex items-center gap-1.5">
        <Filter className="h-3 w-3 text-neutral-400" />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as "all" | CodeRole)}
          className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="all">Všetky roly</option>
          {CODE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "used" | "shared" | "free")}
          className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="all">Všetky stavy</option>
          <option value="free">Nepoužité</option>
          <option value="shared">Zdieľané</option>
          <option value="used">Použité</option>
        </select>
        <span className="ml-auto text-[10px] text-neutral-400">{filtered.length} zázn.</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-500">Žiadne kódy.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-200 dark:border-white/10">
          <table className="w-full text-[11px] text-neutral-800 dark:text-neutral-200">
            <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-white/5">
              <tr>
                <th className="px-2 py-1.5 font-medium">Kód</th>
                <th className="px-2 py-1.5 font-medium">Rola</th>
                <th className="px-2 py-1.5 font-medium">Vytvoril</th>
                <th className="px-2 py-1.5 font-medium">Obec</th>
                <th className="px-2 py-1.5 font-medium">Stav</th>
                <th className="px-2 py-1.5 font-medium">Použil</th>
                <th className="px-2 py-1.5 font-medium">História</th>
                <th className="px-1 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = codeStatus(c);
                return (
                  <tr key={c.id} className="border-t border-neutral-100 dark:border-white/5">
                    <td className="px-2 py-1.5 font-mono tracking-wider">
                      <span className={status !== "free" ? "text-neutral-400 line-through" : ""}>{c.code}</span>
                      {status === "free" && (
                        <button
                          onClick={() => copy(c.code)}
                          className="ml-1 rounded p-0.5 hover:bg-neutral-100 dark:hover:bg-white/10"
                          aria-label="Kopírovať"
                        >
                          {copied === c.code ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{c.role}</td>
                    <td className="px-2 py-1.5 text-neutral-500">
                      {c.created_by ? (users[c.created_by]?.name ?? c.created_by.slice(0, 6)) : "—"}
                    </td>
                    <td className="px-2 py-1.5">{muniName(c.municipality_id)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          status === "used"
                            ? "bg-neutral-100 text-neutral-500 dark:bg-white/10"
                            : status === "shared"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        }`}
                      >
                        {status === "used" ? "Použitý" : status === "shared" ? "Zdieľaný" : "Voľný"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-500">
                      {c.used_by ? (users[c.used_by]?.name ?? c.used_by.slice(0, 6)) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-neutral-400">
                      <div>Vytvorený: {new Date(c.created_at).toLocaleDateString("sk-SK")}</div>
                      {c.shared_at && (
                        <div>
                          Zdieľaný: {new Date(c.shared_at).toLocaleDateString("sk-SK")}
                          {c.shared_via ? ` (${c.shared_via})` : ""}
                        </div>
                      )}
                      {c.used_at && <div>Použitý: {new Date(c.used_at).toLocaleDateString("sk-SK")}</div>}
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        onClick={() => remove(c.id)}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        aria-label="Vymazať"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-neutral-400">
        Zdieľané a použité kódy ostávajú v histórii pre administrátorský prehľad.
      </p>
    </div>
  );
}

// ---------- Role assigner ----------

function RoleAssigner() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id, name, role").order("name");
    setUsers((data as UserRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);

    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.clearTimeout(id);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, search]);

  async function assign(userId: string, role: ProfileRole) {
    setBusy(userId);
    setErr(null);
    const { error: perr } = await supabase.from("profiles").update({ role }).eq("id", userId);

    if (perr) {
      console.error("Failed to update profile role", { userId, role, error: perr });
      setBusy(null);
      setErr(perr.message);
      return;
    }

    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

    setBusy(null);
    if (roleErr) {
      console.error("Failed to upsert user role", { userId, role, error: roleErr });
      setErr(roleErr.message);
      return;
    }

    await load();
  }

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        <UserCog className="h-3.5 w-3.5" /> Priradiť rolu
      </h4>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Vyhľadať suseda podľa mena"
        className="mb-2"
      />
      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {filteredUsers.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-800 dark:text-neutral-200">
                {u.name}
              </span>
              <select
                value={u.role}
                onChange={(e) => assign(u.id, e.target.value as ProfileRole)}
                disabled={busy === u.id}
                className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {ROLE_CHOICES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Municipality manager ----------

function MunicipalityManager() {
  const [munis, setMunis] = useState<Muni[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<Muni>>>({});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [mayorName, setMayorName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("municipalities")
      .select("id, slug, name, region, mayor_name, logo_url")
      .order("name");
    setMunis((data as Muni[] | null) ?? []);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("municipalities").insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      region: region.trim() || null,
      mayor_name: mayorName.trim() || null,
      logo_url: logoUrl.trim() || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setName("");
    setSlug("");
    setRegion("");
    setMayorName("");
    setLogoUrl("");
    await load();
  }

  async function saveEdit(id: string) {
    const patch = editing[id];
    if (!patch) return;
    setErr(null);
    const { error } = await supabase
      .from("municipalities")
      .update({
        name: patch.name?.trim(),
        region: patch.region?.trim() || null,
        mayor_name: (patch.mayor_name ?? "").trim() || null,
        logo_url: (patch.logo_url ?? "").trim() || null,
      })
      .eq("id", id);
    if (error) return setErr(error.message);
    setEditing((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
    await load();
  }

  async function removeMuni(id: string, muniName: string) {
    if (!confirm(`Vymazať obec "${muniName}"? Toto zlyhá, ak v nej sú susedia.`)) return;
    const { error } = await supabase.from("municipalities").delete().eq("id", id);
    if (error) return setErr(error.message);
    await load();
  }

  const startEdit = (m: Muni) =>
    setEditing((s) => ({
      ...s,
      [m.id]: {
        name: m.name,
        region: m.region ?? "",
        mayor_name: m.mayor_name ?? "",
        logo_url: m.logo_url ?? "",
      },
    }));

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        <MapPin className="h-3.5 w-3.5" /> Správa obcí
      </h4>
      <ul className="mb-3 space-y-1.5">
        {munis.map((m) => {
          const e = editing[m.id];
          if (e) {
            return (
              <li
                key={m.id}
                className="space-y-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-2 text-xs dark:border-indigo-400/30 dark:bg-indigo-500/10"
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    value={e.name ?? ""}
                    onChange={(ev) =>
                      setEditing((s) => ({ ...s, [m.id]: { ...s[m.id], name: ev.target.value } }))
                    }
                    placeholder="Názov"
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                  <input
                    value={e.region ?? ""}
                    onChange={(ev) =>
                      setEditing((s) => ({ ...s, [m.id]: { ...s[m.id], region: ev.target.value } }))
                    }
                    placeholder="Kraj"
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                  <input
                    value={e.mayor_name ?? ""}
                    onChange={(ev) =>
                      setEditing((s) => ({
                        ...s,
                        [m.id]: { ...s[m.id], mayor_name: ev.target.value },
                      }))
                    }
                    placeholder="Meno starostu"
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                  <input
                    value={e.logo_url ?? ""}
                    onChange={(ev) =>
                      setEditing((s) => ({
                        ...s,
                        [m.id]: { ...s[m.id], logo_url: ev.target.value },
                      }))
                    }
                    placeholder="URL loga / erbu"
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() =>
                      setEditing((s) => {
                        const n = { ...s };
                        delete n[m.id];
                        return n;
                      })
                    }
                    className="rounded-md px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:hover:bg-white/10"
                  >
                    Zrušiť
                  </button>
                  <button
                    onClick={() => void saveEdit(m.id)}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white"
                  >
                    Uložiť
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
            >
              {m.logo_url ? (
                <img src={m.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400 dark:bg-white/10">
                  {m.name[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                  {m.name} <span className="font-normal text-neutral-400">/{m.slug}</span>
                </div>
                <div className="truncate text-[10px] text-neutral-500">
                  {m.region ?? "—"} · Starosta: {m.mayor_name ?? "—"}
                </div>
              </div>
              <button
                onClick={() => startEdit(m)}
                className="rounded-md px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                Upraviť
              </button>
              <button
                onClick={() => void removeMuni(m.id, m.name)}
                className="rounded-md p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                aria-label="Vymazať"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={add}
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-dashed border-neutral-300 p-2 dark:border-white/10"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Názov obce"
          required
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug (napr. ruzindol)"
          required
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Kraj / okres"
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
        />
        <input
          value={mayorName}
          onChange={(e) => setMayorName(e.target.value)}
          placeholder="Meno starostu"
          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
        />
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="URL loga / erbu (voliteľné)"
          className="col-span-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-200 dark:text-neutral-900 dark:placeholder:text-neutral-600"
        />
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Pridať obec
        </button>
      </form>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
