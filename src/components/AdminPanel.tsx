import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Copy, Check, Shield, MapPin, UserCog, Trash2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRole } from "@/hooks/useCurrentUser";

type CodeRole = "Sused" | "Uradnik" | "Starosta" | "Farar";

type InviteRow = {
  id: string;
  code: string;
  role: CodeRole;
  municipality_id: string | null;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
};

type Muni = { id: string; slug: string; name: string; region: string | null };
type UserRow = { id: string; name: string; role: ProfileRole };

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

export function AdminPanel({ adminId }: { adminId: string }) {
  return (
    <div className="rounded-3xl border-2 border-indigo-300/60 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:from-indigo-500/10 dark:to-transparent dark:border-indigo-400/30">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Administrátor
          </h3>
          <p className="text-[11px] text-neutral-500">
            Správa pozvánok a rolí · auto-čistenie po 3 dňoch
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <InviteCodeManager adminId={adminId} />
        <RoleAssigner />
        <MunicipalityManager />
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
  const [filterStatus, setFilterStatus] = useState<"all" | "used" | "free">("all");

  const load = async () => {
    setLoading(true);
    const [{ data: mData }, { data: cData }] = await Promise.all([
      supabase.from("municipalities").select("id, slug, name, region").order("name"),
      supabase
        .from("invite_codes")
        .select("id, code, role, municipality_id, created_at, used_by, used_at")
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
    const ids = Array.from(new Set(rows.map((r) => r.used_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ids);
      const map: Record<string, { name: string }> = {};
      (pData ?? []).forEach((p: any) => (map[p.id] = { name: p.name }));
      setUsers(map);
    } else {
      setUsers({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
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
    id ? munis.find((m) => m.id === id)?.name ?? "—" : "—";

  const filtered = useMemo(
    () =>
      codes.filter((c) => {
        if (filterRole !== "all" && c.role !== filterRole) return false;
        if (filterStatus === "used" && !c.used_by) return false;
        if (filterStatus === "free" && c.used_by) return false;
        return true;
      }),
    [codes, filterRole, filterStatus],
  );

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Generovanie pozvánok
      </h4>

      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
        <label className="col-span-1 text-[11px]">
          <span className="mb-0.5 block text-neutral-500">Rola</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CodeRole)}
            className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs dark:border-white/10 dark:bg-neutral-800"
          >
            {CODE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-1 text-[11px]">
          <span className="mb-0.5 block text-neutral-500">Obec</span>
          <select
            value={muniId}
            onChange={(e) => setMuniId(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs dark:border-white/10 dark:bg-neutral-800"
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
        </div>
      </div>

      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}

      <div className="mb-2 flex items-center gap-1.5">
        <Filter className="h-3 w-3 text-neutral-400" />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as any)}
          className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] dark:border-white/10 dark:bg-neutral-800"
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
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] dark:border-white/10 dark:bg-neutral-800"
        >
          <option value="all">Všetky stavy</option>
          <option value="free">Nepoužité</option>
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
          <table className="w-full text-[11px]">
            <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-white/5">
              <tr>
                <th className="px-2 py-1.5 font-medium">Kód</th>
                <th className="px-2 py-1.5 font-medium">Rola</th>
                <th className="px-2 py-1.5 font-medium">Obec</th>
                <th className="px-2 py-1.5 font-medium">Stav</th>
                <th className="px-2 py-1.5 font-medium">Použil</th>
                <th className="px-2 py-1.5 font-medium">Dátum</th>
                <th className="px-1 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const used = !!c.used_by;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-neutral-100 dark:border-white/5"
                  >
                    <td className="px-2 py-1.5 font-mono tracking-wider">
                      <span className={used ? "text-neutral-400 line-through" : ""}>
                        {c.code}
                      </span>
                      {!used && (
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
                    <td className="px-2 py-1.5">{muniName(c.municipality_id)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          used
                            ? "bg-neutral-100 text-neutral-500 dark:bg-white/10"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        }`}
                      >
                        {used ? "Použitý" : "Voľný"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-500">
                      {c.used_by ? users[c.used_by]?.name ?? c.used_by.slice(0, 6) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-neutral-400">
                      {new Date(c.created_at).toLocaleDateString("sk-SK")}
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
        Použité kódy sa automaticky mažú po 3 dňoch (šetrenie DB).
      </p>
    </div>
  );
}

// ---------- Role assigner ----------

function RoleAssigner() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, name, role")
      .order("name")
      .limit(100);
    setUsers((data as UserRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  async function assign(userId: string, role: ProfileRole) {
    setBusy(userId);
    setErr(null);
    const { error: perr } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role }).select();
    setBusy(null);
    if (perr) return setErr(perr.message);
    await load();
  }

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        <UserCog className="h-3.5 w-3.5" /> Priradiť rolu
      </h4>
      {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {users.map((u) => (
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
                className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] dark:border-white/10 dark:bg-neutral-800"
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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("municipalities")
      .select("id, slug, name, region")
      .order("name");
    setMunis((data as Muni[] | null) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("municipalities")
      .insert({ name: name.trim(), slug: slug.trim().toLowerCase(), region: region.trim() || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setName("");
    setSlug("");
    setRegion("");
    await load();
  }

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        <MapPin className="h-3.5 w-3.5" /> Obce v systéme
      </h4>
      <ul className="mb-3 space-y-1">
        {munis.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
          >
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{m.name}</span>
            <span className="text-neutral-400">/{m.slug}</span>
            {m.region && <span className="ml-auto text-neutral-500">{m.region}</span>}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="grid grid-cols-3 gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Názov"
          required
          className="col-span-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug"
          required
          className="col-span-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Kraj"
          className="col-span-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
        />
        <button
          type="submit"
          disabled={busy}
          className="col-span-3 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Pridať obec
        </button>
      </form>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
