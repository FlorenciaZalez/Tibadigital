import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, KeyRound, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Key {
  id: string;
  key_type: "code" | "account";
  content: string;
  notes: string | null;
  status: "available" | "reserved" | "delivered";
  created_at: string;
  delivered_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  available: "bg-success/20 text-success border-success/40",
  reserved: "bg-warning/20 text-warning border-warning/40",
  delivered: "bg-muted text-muted-foreground border-border",
};

const ProductKeys = () => {
  const { id } = useParams<{ id: string }>();
  const [productTitle, setProductTitle] = useState("");
  const [keys, setKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"code" | "account">("code");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [bulk, setBulk] = useState("");

  useEffect(() => {
    document.title = "Stock de keys | TIBADIGITAL";
    refresh();
  }, [id]);

  const refresh = async () => {
    setLoading(true);
    const [{ data: prod }, { data: ks }] = await Promise.all([
      supabase.from("products").select("title").eq("id", id!).single(),
      supabase.from("product_keys").select("*").eq("product_id", id!).order("created_at", { ascending: false }),
    ]);
    if (prod) setProductTitle(prod.title);
    if (ks) setKeys(ks as any);
    setLoading(false);
  };

  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const { error } = await supabase.from("product_keys").insert({
      product_id: id, key_type: type, content: content.trim(), notes: notes.trim() || null,
    });
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Key agregada"); setContent(""); setNotes(""); refresh(); }
  };

  const addBulk = async () => {
    if (type === "account") {
      toast.error("Las cuentas con varios datos deben cargarse una por una");
      return;
    }
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((line) => ({ product_id: id, key_type: type, content: line }));
    const { error } = await supabase.from("product_keys").insert(rows);
    if (error) toast.error("Error: " + error.message);
    else { toast.success(`${lines.length} keys agregadas`); setBulk(""); refresh(); }
  };

  const remove = async (kid: string, status: string) => {
    if (status === "delivered" && !confirm("Esta key ya fue entregada. ¿Eliminarla del registro igual?")) return;
    if (status !== "delivered" && !confirm("¿Eliminar esta key?")) return;
    await supabase.from("product_keys").delete().eq("id", kid);
    toast.success("Eliminada");
    refresh();
  };

  const counts = {
    available: keys.filter((k) => k.status === "available").length,
    reserved: keys.filter((k) => k.status === "reserved").length,
    delivered: keys.filter((k) => k.status === "delivered").length,
  };

  return (
    <div className="container py-10 max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/admin"><ChevronLeft />Admin</Link>
      </Button>

      <h1 className="font-display font-black text-3xl md:text-4xl mb-2">
        STOCK DE <span className="text-gradient-neon">KEYS</span>
      </h1>
      <p className="text-muted-foreground mb-8">{productTitle}</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Disponibles", value: counts.available, color: "success" },
          { label: "Reservadas", value: counts.reserved, color: "warning" },
          { label: "Entregadas", value: counts.delivered, color: "muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="card-cyber p-4 rounded-xl">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className={`font-display font-black text-2xl text-${s.color} mt-1`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card-cyber p-5 rounded-xl space-y-4">
          <h2 className="font-display font-bold uppercase tracking-wider flex items-center gap-2">
            <Plus className="h-4 w-4 text-secondary" />Agregar una key
          </h2>
          <form onSubmit={addOne} className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="code">Código de activación</SelectItem>
                  <SelectItem value="account">Cuenta completa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contenido *</Label>
              {type === "account" ? (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder={"Numero de cuenta: 12345\nUsuario: usuario@correo.com\nClave: clave123"}
                  className="bg-input mt-1 font-mono text-sm"
                />
              ) : (
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="ABC-123-XYZ"
                  className="bg-input mt-1 font-mono"
                />
              )}
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: no cambiar mail, usar perfil 1, observaciones extra" className="bg-input mt-1" />
            </div>
            <Button type="submit" variant="hero" className="w-full">Agregar key</Button>
          </form>
        </div>

        <div className="card-cyber p-5 rounded-xl space-y-4">
          <h2 className="font-display font-bold uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-secondary" />Carga masiva
          </h2>
          <p className="text-xs text-muted-foreground">
            {type === "account"
              ? "La carga masiva queda solo para codigos. Las cuentas completas cargalas una por una."
              : "Pega un codigo por linea. Usara el tipo seleccionado a la izquierda."}
          </p>
          <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} placeholder={"key1\nkey2\nkey3"} className="bg-input font-mono text-sm" />
          <Button onClick={addBulk} variant="neon" className="w-full" disabled={!bulk.trim() || type === "account"}>
            Agregar todas ({bulk.split("\n").filter((l) => l.trim()).length})
          </Button>
        </div>
      </div>

      <div className="card-cyber rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-display font-bold uppercase tracking-wider text-sm">Listado de keys</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Cargando...</div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Sin keys cargadas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Contenido</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Notas</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3 font-display text-xs uppercase">{k.key_type}</td>
                    <td className="p-3 font-mono text-xs max-w-xs truncate" title={k.content}>
                      {k.status === "delivered" ? "•••••••• (entregada)" : k.content}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider border ${STATUS_BADGE[k.status]}`}>
                        {k.status === "available" && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                        {k.status === "reserved" && <Clock className="h-3 w-3 inline mr-1" />}
                        {k.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{k.notes || "—"}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(k.id, k.status)} className="hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductKeys;
