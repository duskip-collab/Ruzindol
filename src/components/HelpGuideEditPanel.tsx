import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Save, X, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type HelpSection = {
  id: string;
  section_key: string;
  section_title: string;
  section_emoji: string;
  section_order: number;
  content: {
    description: string;
    items: Array<{
      label: string;
      text: string;
    }>;
  };
  updated_at: string;
  updated_by?: string;
};

export function HelpGuideEditPanel() {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<HelpSection>>({});
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
        setSections(data || []);
      } catch (error) {
        console.error("Error loading help sections:", error);
        toast({
          title: "Chyba pri načítaní",
          description: "Nepodarilo sa načítať návod na používanie",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSections(false);
      }
    };

    loadSections();
  }, [isAdmin, toast]);

  const handleEdit = (section: HelpSection) => {
    setEditingSectionId(section.id);
    setEditValues(JSON.parse(JSON.stringify(section)));
  };

  const handleCancel = () => {
    setEditingSectionId(null);
    setEditValues({});
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
          updated_by: user?.id,
        })
        .eq("id", editingSectionId);

      if (error) throw error;

      // Aktualizuj lokálne
      setSections((prev) =>
        prev.map((s) =>
          s.id === editingSectionId ? { ...s, ...editValues } : s
        )
      );

      setEditingSectionId(null);
      setEditValues({});

      toast({
        title: "Uložené",
        description: "Sekcia bola úspešne aktualizovaná",
      });
    } catch (error) {
      console.error("Error saving section:", error);
      toast({
        title: "Chyba pri ukladaní",
        description: "Nepodarilo sa uložiť zmeny",
        variant: "destructive",
      });
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              Admin Režim - Editovanie Návodu
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Kliknite na tlačidlo Upraviť pri jednotlivých sekciách aby ste ich mohli upravovať.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isEditing = editingSectionId === section.id;
          const current = isEditing ? editValues : section;

          return (
            <div
              key={section.id}
              className="rounded-lg border border-border bg-card p-4 dark:bg-card/50"
            >
              {isEditing ? (
                // Režim editácie
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium">Emoji & Nadpis</label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        maxLength={2}
                        value={current.section_emoji || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            section_emoji: e.target.value,
                          })
                        }
                        className="h-10 w-12 rounded border border-input bg-background px-2 text-center"
                        placeholder="🔔"
                      />
                      <input
                        type="text"
                        value={current.section_title || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            section_title: e.target.value,
                          })
                        }
                        className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Úvodný Opis</label>
                    <textarea
                      value={current.content?.description || ""}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          content: {
                            ...current.content,
                            description: e.target.value,
                          },
                        })
                      }
                      className="mt-1 min-h-[80px] w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Položky</label>
                    <div className="space-y-2">
                      {current.content?.items?.map((item, idx) => (
                        <div key={idx} className="space-y-1 rounded bg-muted/50 p-2">
                          <input
                            type="text"
                            placeholder="Nadpis"
                            value={item.label}
                            onChange={(e) => {
                              const newItems = [...(current.content?.items || [])];
                              newItems[idx].label = e.target.value;
                              setEditValues({
                                ...editValues,
                                content: {
                                  ...current.content,
                                  items: newItems,
                                },
                              });
                            }}
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-semibold"
                          />
                          <textarea
                            placeholder="Text"
                            value={item.text}
                            onChange={(e) => {
                              const newItems = [...(current.content?.items || [])];
                              newItems[idx].text = e.target.value;
                              setEditValues({
                                ...editValues,
                                content: {
                                  ...current.content,
                                  items: newItems,
                                },
                              });
                            }}
                            className="min-h-[60px] w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? "Ukladám..." : "Uložiť"}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 rounded bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80"
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
                      Upravené: {new Date(section.updated_at).toLocaleDateString("sk-SK")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(section)}
                    className="mt-1 flex items-center gap-2 rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
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
