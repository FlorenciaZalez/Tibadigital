import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, FileText, Loader2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { getAccountTierLabel, type AccountTier } from "@/lib/productVariants";
import { toast } from "sonner";

type InstructionRow = Tables<"account_tier_instructions">;
type InstructionPlatform = "PS4" | "PS5";
type InstructionKey = `${AccountTier}_${Lowercase<InstructionPlatform>}`;

const MANAGED_TIERS: AccountTier[] = ["primary", "secondary", "plus"];
const MANAGED_PLATFORMS: InstructionPlatform[] = ["PS4", "PS5"];

const MANAGED_COMBINATIONS = MANAGED_TIERS.flatMap((tier) =>
  MANAGED_PLATFORMS.map((platform) => ({
    key: `${tier}_${platform.toLowerCase()}` as InstructionKey,
    tier,
    platform,
  })),
);

const createEmptyInstructionState = () => ({
  primary_ps4: null,
  primary_ps5: null,
  secondary_ps4: null,
  secondary_ps5: null,
  plus_ps4: null,
  plus_ps5: null,
} satisfies Record<InstructionKey, InstructionRow | null>);

const createEmptyFormState = () => ({
  primary_ps4: { instruction_text: "", image_url: "" },
  primary_ps5: { instruction_text: "", image_url: "" },
  secondary_ps4: { instruction_text: "", image_url: "" },
  secondary_ps5: { instruction_text: "", image_url: "" },
  plus_ps4: { instruction_text: "", image_url: "" },
  plus_ps5: { instruction_text: "", image_url: "" },
} satisfies Record<InstructionKey, { instruction_text: string; image_url: string }>);

const getInstructionKey = (tier: AccountTier, platform: InstructionPlatform) => `${tier}_${platform.toLowerCase()}` as InstructionKey;

const AdminInstructions = ({ embedded = false }: { embedded?: boolean }) => {
  const [instructions, setInstructions] = useState<Record<InstructionKey, InstructionRow | null>>(createEmptyInstructionState());
  const [form, setForm] = useState<Record<InstructionKey, { instruction_text: string; image_url: string }>>(createEmptyFormState());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<InstructionKey | null>(null);
  const [uploadingKey, setUploadingKey] = useState<InstructionKey | null>(null);

  useEffect(() => {
    document.title = "Instructivos | Admin TIBADIGITAL";
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("account_tier_instructions")
      .select("*")
      .in("tier", MANAGED_TIERS)
      .in("platform", MANAGED_PLATFORMS);

    if (error) {
      toast.error(`No pudimos cargar los instructivos: ${error.message}`);
      setLoading(false);
      return;
    }

    const nextInstructions = createEmptyInstructionState();
    const nextForm = createEmptyFormState();

    (data ?? []).forEach((row) => {
      const tier = row.tier as AccountTier;
      const platform = row.platform as InstructionPlatform;
      if (!MANAGED_TIERS.includes(tier) || !MANAGED_PLATFORMS.includes(platform)) return;

      const key = getInstructionKey(tier, platform);

      nextInstructions[key] = row;
      nextForm[key] = {
        instruction_text: row.instruction_text ?? "",
        image_url: row.image_url ?? "",
      };
    });

    setInstructions(nextInstructions);
    setForm(nextForm);
    setLoading(false);
  };

  const handleUpload = async (tier: AccountTier, platform: InstructionPlatform, file: File) => {
    const key = getInstructionKey(tier, platform);
    setUploadingKey(key);

    const ext = file.name.split(".").pop() ?? "png";
    const path = `instructions/${tier}-${platform.toLowerCase()}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });

    if (error) {
      toast.error(`No pudimos subir la imagen: ${error.message}`);
      setUploadingKey(null);
      return;
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        image_url: data.publicUrl,
      },
    }));
    setUploadingKey(null);
    toast.success(`Imagen cargada para ${getAccountTierLabel(tier)} ${platform}`);
  };

  const handleSave = async (tier: AccountTier, platform: InstructionPlatform) => {
    const key = getInstructionKey(tier, platform);
    setSavingKey(key);

    const payload = {
      tier,
      platform,
      instruction_text: form[key].instruction_text.trim(),
      image_url: form[key].image_url.trim() || null,
    };

    const { error } = await supabase
      .from("account_tier_instructions")
      .upsert(payload, { onConflict: "tier,platform" });

    setSavingKey(null);

    if (error) {
      toast.error(`No pudimos guardar el instructivo: ${error.message}`);
      return;
    }

    toast.success(`Instructivo ${getAccountTierLabel(tier)} ${platform} guardado`);
    refresh();
  };

  return (
    <div className={cn("max-w-none", embedded ? "space-y-8" : "container py-10")}>
      {!embedded && (
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/admin"><ChevronLeft />Volver al admin</Link>
        </Button>
      )}

      <div className="mb-8 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">// Contenido de entrega</div>
        <h1 className="font-display font-black text-3xl md:text-4xl">
          INSTRUCTIVOS <span className="text-gradient-neon">POR TIPO Y CONSOLA</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Cada instructivo se adjunta automaticamente en el mail de entrega según la combinación exacta de tipo de cuenta y consola.
        </p>
      </div>

      {loading ? (
        <div className="card-cyber rounded-xl p-10 text-center text-muted-foreground">Cargando instructivos...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 items-stretch">
          {MANAGED_COMBINATIONS.map(({ key, tier, platform }) => (
            <div key={key} className="card-cyber rounded-xl p-6 h-full flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-secondary/15 p-2 text-secondary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-lg uppercase tracking-wider">
                    {getAccountTierLabel(tier)} {platform}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Se adjunta al entregar cuentas {getAccountTierLabel(tier).toLowerCase()}s de {platform}.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor={`instruction-${key}`}>Texto del instructivo</Label>
                <Textarea
                  id={`instruction-${key}`}
                  value={form[key].instruction_text}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    [key]: {
                      ...current[key],
                      instruction_text: event.target.value,
                    },
                  }))}
                  className="bg-input min-h-40"
                  placeholder={`Pasos para usar la cuenta ${getAccountTierLabel(tier).toLowerCase()} en ${platform}`}
                />
              </div>

              <div className="space-y-3 flex-1 flex flex-col">
                <Label>Imagen del instructivo</Label>
                <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4 flex-1 flex flex-col justify-between min-h-[280px]">
                  {form[key].image_url ? (
                    <div className="rounded-lg overflow-hidden border border-border bg-background/60">
                      <img src={form[key].image_url} alt={`Instructivo ${tier} ${platform}`} className="w-full h-40 object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center min-h-40">
                      No cargaste imagen todavía.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      id={`instruction-upload-${key}`}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleUpload(tier, platform, file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingKey === key}
                      onClick={() => document.getElementById(`instruction-upload-${key}`)?.click()}
                    >
                      {uploadingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingKey === key ? "Subiendo..." : "Subir imagen"}
                    </Button>
                    {form[key].image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setForm((current) => ({
                          ...current,
                          [key]: {
                            ...current[key],
                            image_url: "",
                          },
                        }))}
                      >
                        <X className="h-4 w-4" />Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <Button type="button" variant="hero" className="w-full justify-center" disabled={savingKey === key} onClick={() => handleSave(tier, platform)}>
                  {savingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingKey === key ? "Guardando..." : "Guardar instructivo"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInstructions;