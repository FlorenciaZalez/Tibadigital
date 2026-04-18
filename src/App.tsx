import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index.tsx";
import Catalogo from "./pages/Catalogo.tsx";
import Estrenos from "./pages/Estrenos.tsx";
import PsPlus from "./pages/PsPlus.tsx";
import Secundarias from "./pages/Secundarias.tsx";
import ProductoDetalle from "./pages/ProductoDetalle.tsx";
import Carrito from "./pages/Carrito.tsx";
import Checkout from "./pages/Checkout.tsx";
import MercadoPagoCheckout from "./pages/MercadoPagoCheckout.tsx";
import MercadoPagoResult from "./pages/MercadoPagoResult.tsx";
import Auth from "./pages/Auth.tsx";
import Cuenta from "./pages/Cuenta.tsx";
import MisPedidos from "./pages/MisPedidos.tsx";
import Admin from "./pages/Admin.tsx";
import ProductoForm from "./pages/admin/ProductoForm.tsx";
import ProductKeys from "./pages/admin/ProductKeys.tsx";
import AdminPedidos from "./pages/admin/AdminPedidos.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/catalogo" element={<Catalogo />} />
                <Route path="/estrenos" element={<Estrenos />} />
                <Route path="/ps-plus" element={<PsPlus />} />
                <Route path="/secundarias" element={<Secundarias />} />
                <Route path="/producto/:slug" element={<ProductoDetalle />} />
                <Route path="/carrito" element={<Carrito />} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/checkout/mercadopago/:orderId" element={<ProtectedRoute><MercadoPagoCheckout /></ProtectedRoute>} />
                <Route path="/checkout/mercadopago/resultado" element={<ProtectedRoute><MercadoPagoResult /></ProtectedRoute>} />
                <Route path="/cuenta" element={<ProtectedRoute><Cuenta /></ProtectedRoute>} />
                <Route path="/cuenta/pedidos" element={<ProtectedRoute><MisPedidos /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
                <Route path="/admin/pedidos" element={<ProtectedRoute adminOnly><AdminPedidos /></ProtectedRoute>} />
                <Route path="/admin/producto/:id" element={<ProtectedRoute adminOnly><ProductoForm /></ProtectedRoute>} />
                <Route path="/admin/producto/:id/keys" element={<ProtectedRoute adminOnly><ProductKeys /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
