import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    slug: string;
    price: number;
    discount_price: number | null;
    cover_url: string | null;
    stock: number;
    platform: string;
  };
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  total: number;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("cart_items")
      .select(`id, product_id, quantity, product:products(id, title, slug, price, discount_price, cover_url, stock, platform)`)
      .eq("user_id", user.id);
    if (!error && data) setItems(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addToCart = async (productId: string, quantity = 1) => {
    if (!user) {
      toast.error("Iniciá sesión para agregar al carrito");
      return;
    }
    const existing = items.find((i) => i.product_id === productId);
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + quantity);
    } else {
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: productId,
        quantity,
      });
      if (error) toast.error("Error al agregar al carrito");
      else {
        toast.success("Agregado al carrito");
        await refresh();
      }
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return removeItem(itemId);
    const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", itemId);
    if (error) toast.error("Error al actualizar");
    else await refresh();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    if (error) toast.error("Error al eliminar");
    else {
      toast.success("Eliminado del carrito");
      await refresh();
    }
  };

  const clearCart = async () => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    await refresh();
  };

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const total = items.reduce((acc, i) => acc + i.quantity * Number(i.product.discount_price ?? i.product.price), 0);

  return (
    <CartContext.Provider value={{ items, loading, itemCount, total, addToCart, updateQuantity, removeItem, clearCart, refresh }}>
      {children}
    </CartContext.Provider>
  );
};
