import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, CircleHelp, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FaqRow = Tables<"faqs">;

const emptyForm = {
  question: "",
  answer: "",
  sort_order: "0",
  is_active: true,
};

const AdminFaqs = ({ embedded = false }: { embedded?: boolean }) => {
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    document.title = "Preguntas frecuentes | Admin TIBADIGITAL";
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(`No pudimos cargar las FAQs: ${error.message}`);
    } else {
      setFaqs(data ?? []);
    }

    setLoading(false);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (faq: FaqRow) => {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      sort_order: String(faq.sort_order),
      is_active: faq.is_active,
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("La pregunta y la respuesta son obligatorias");
      return;
    }

    setSaving(true);

    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    const { error } = editingId
      ? await supabase.from("faqs").update(payload).eq("id", editingId)
      : await supabase.from("faqs").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(`No pudimos guardar la FAQ: ${error.message}`);
      return;
    }

    toast.success(editingId ? "FAQ actualizada" : "FAQ creada");
    resetForm();
    refresh();
  };

  const handleDelete = async (faq: FaqRow) => {
    if (!confirm(`¿Eliminar la pregunta "${faq.question}"?`)) return;

    const { error } = await supabase.from("faqs").delete().eq("id", faq.id);

    if (error) {
      toast.error(`No pudimos eliminar la FAQ: ${error.message}`);
      return;
    }

    toast.success("FAQ eliminada");
    if (editingId === faq.id) resetForm();
    refresh();
  };

  return (
    <div className={cn(embedded ? "w-full max-w-none space-y-8" : "container py-10 max-w-6xl")}>
      {!embedded && (
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/admin"><ChevronLeft />Volver al admin</Link>
        </Button>
      )}

      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display mb-2">// Contenido editable</div>
          <h1 className="font-display font-black text-3xl md:text-4xl">
            PREGUNTAS <span className="text-gradient-neon">FRECUENTES</span>
          </h1>
        </div>
        <div className="px-3 py-1.5 rounded-md border border-border bg-card/60 text-sm font-display">
          {faqs.length} FAQ{faqs.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card-cyber rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between gap-3">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider">FAQs cargadas</h2>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Plus className="h-4 w-4" />Nueva FAQ
            </Button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Cargando...</div>
          ) : faqs.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <CircleHelp className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Todavía no cargaste preguntas frecuentes.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {faqs.map((faq) => (
                <div key={faq.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-display tracking-wider bg-muted text-muted-foreground">
                        Orden {faq.sort_order}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${faq.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                        {faq.is_active ? "VISIBLE" : "OCULTA"}
                      </span>
                    </div>
                    <h3 className="font-semibold leading-snug">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{faq.answer}</p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(faq)} title="Editar FAQ">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(faq)} className="hover:text-destructive" title="Eliminar FAQ">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-cyber p-6 rounded-xl">
          <h2 className="font-display font-bold text-lg uppercase tracking-wider mb-4">
            {editingId ? "Editar FAQ" : "Nueva FAQ"}
          </h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <Label htmlFor="faq-question">Pregunta</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(event) => setForm({ ...form, question: event.target.value })}
                className="bg-input mt-1"
                placeholder="Ej: ¿Cuánto tarda la entrega?"
              />
            </div>

            <div>
              <Label htmlFor="faq-answer">Respuesta</Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(event) => setForm({ ...form, answer: event.target.value })}
                className="bg-input mt-1 min-h-32"
                placeholder="Escribí la respuesta que se va a mostrar en la web"
              />
            </div>

            <div>
              <Label htmlFor="faq-order">Orden</Label>
              <Input
                id="faq-order"
                type="number"
                value={form.sort_order}
                onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                className="bg-input mt-1"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label htmlFor="faq-active" className="text-base">Visible en la web</Label>
                <p className="text-xs text-muted-foreground mt-1">Si la desactivás, queda guardada pero no se muestra al público.</p>
              </div>
              <Switch id="faq-active" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>

            <div className="flex gap-3">
              <Button type="submit" variant="hero" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear FAQ"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar edición
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminFaqs;