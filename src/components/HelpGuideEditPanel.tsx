import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Pencil, Save, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type HelpSection = {
  id: string;
  section_key: string;
  section_title: string;
  section_emoji: string | null;
  section_order: number;
  content: {
    description: string;
    items: Array<{
      label: string;
      text: string;
    }>;
  };
  updated_at: string | null;
  updated_by: string | null;
};

function parseContent(value: Json): HelpSection["content"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { description: "", items: [] };
  }
  const record = value as Record<string, Json | undefined>;
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const entry = item as Record<string, Json | undefined>;
        return typeof entry.label === "string" && typeof entry.text === "string"
          ? [{ label: entry.label, text: entry.text }]
          : [];
      })
    : [];
  return { description: typeof record.description === "string" ? record.description : "", items };
}

export function HelpGuideEditPanel() {
  const { userId } = useCurrentUser();
  const { isAdmin } = useIsAdmin(userId);

  const [sections, setSections] = useState<HelpSection[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<HelpSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);

  // Načítaj sekcie z databázy
  useEffect(() => {
    if (!isAdmin) return;

    const loadSections = async () => {
      setIsLoadingSections(true);
      try {
        const { data, error } = await supabase
          .from("help_guide_sections")
          .select("*")
          .eq("is_active", true)
          .order("section_order", { ascending: true });

        if (error) throw error;
        setSections(
          (data ?? []).map((section) => ({
            ...section,
            content: parseContent(section.content),
          })),
        );
      } catch (error) {
        console.error("Error loading help sections:", error);
        toast.error("Nepodarilo sa načítať návod na používanie");
      } finally {
        setIsLoadingSections(false);
      }
    };

    loadSections();
  }, [isAdmin]);

  const handleEdit = (section: HelpSection) => {
    setEditingSectionId(section.id);
    setEditValues(JSON.parse(JSON.stringify(section)));
  };

  const handleCancel = () => {
    setEditingSectionId(null);
    setEditValues(null);
  };

  const handleSave = async () => {
    if (!editingSectionId || !editValues) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("help_guide_sections")
        .update({
          section_title: editValues.section_title,
          section_emoji: editValues.section_emoji,
          content: editValues.content,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", editingSectionId);

      if (error) throw error;

      // Aktualizuj lokálne
      setSections((prev) =>
        prev.map((s) => (s.id === editingSectionId ? { ...s, ...editValues } : s)),
      );

      setEditingSectionId(null);
      setEditValues(null);

      toast.success("Sekcia bola úspešne aktualizovaná");
    } catch (error) {
      console.error("Error saving section:", error);
      toast.error("Nepodarilo sa uložiť zmeny");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (isLoadingSections) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">
              📖 Admin Režim - Editovanie Návodu
            </h3>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
              Kliknite na tlačidlo „Upraviť" pri jednotlivých sekciách aby ste ich mohli upravovať.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isEditing = editingSectionId === section.id;
          const current = isEditing ? editValues : section;
          if (!current) return null;

          return (
            <div
              key={section.id}
              className="rounded-2xl border border-border/80 bg-card/60 p-4 dark:bg-card/50"
            >
              {isEditing ? (
                // Režim editácie
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Emoji & Nadpis
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        maxLength={2}
                        value={current.section_emoji || ""}
                        onChange={(e) =>
                          setEditValues((previous): HelpSection | null =>
                            previous ? { ...previous, section_emoji: e.target.value } : null,
                          )
                        }
                        className="h-10 w-12 rounded-lg border border-border bg-background px-2 text-center text-sm dark:border-border/50"
                        placeholder="🔔"
                      />
                      <input
                        type="text"
                        value={current.section_title || ""}
                        onChange={(e) =>
                          setEditValues((previous): HelpSection | null =>
                            previous ? { ...previous, section_title: e.target.value } : null,
                          )
                        }
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Úvodný Opis
                    </label>
                    <textarea
                      value={current.content?.description || ""}
                      onChange={(e) =>
                        setEditValues((previous): HelpSection | null =>
                          previous
                            ? {
                                ...previous,
                                content: { ...previous.content, description: e.target.value },
                              }
                            : previous,
                        )
                      }
                      className="mt-1 min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Položky
                    </label>
                    <div className="space-y-2">
                      {current.content?.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 rounded-lg bg-muted/50 p-3 border border-border/50"
                        >
                          <input
                            type="text"
                            placeholder="Nadpis"
                            value={item.label}
                            onChange={(e) => {
                              const newItems = [...(current.content?.items || [])];
                              newItems[idx].label = e.target.value;
                              setEditValues((previous): HelpSection | null =>
                                previous
                                  ? {
                                      ...previous,
                                      content: { ...previous.content, items: newItems },
                                    }
                                  : previous,
                              );
                            }}
                            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm font-semibold dark:border-border/50"
                          />
                          <textarea
                            placeholder="Text"
                            value={item.text}
                            onChange={(e) => {
                              const newItems = [...(current.content?.items || [])];
                              newItems[idx].text = e.target.value;
                              setEditValues((previous): HelpSection | null =>
                                previous
                                  ? {
                                      ...previous,
                                      content: { ...previous.content, items: newItems },
                                    }
                                  : previous,
                              );
                            }}
                            className="min-h-[60px] w-full rounded-lg border border-border bg-background px-2 py-1 text-sm dark:border-border/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? "Ukladám..." : "Uložiť"}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium hover:bg-muted/80 dark:border-border/50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Zrušiť
                    </button>
                  </div>
                </div>
              ) : (
                // Režim čítania
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {section.section_emoji} {section.section_title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.content?.description}
                    </p>
                    <div className="mt-2 space-y-1">
                      {section.content?.items?.map((item, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          <span className="font-semibold">{item.label}:</span>{" "}
                          {item.text.substring(0, 60)}...
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground/60">
                      Upravené:{" "}
                      {section.updated_at
                        ? new Date(section.updated_at).toLocaleDateString("sk-SK")
                        : "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(section)}
                    className="mt-1 flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Upraviť
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
