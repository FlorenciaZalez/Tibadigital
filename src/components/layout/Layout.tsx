import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const Layout = () => (
  <div className="min-h-screen flex flex-col bg-background relative" style={{ overflowX: "clip" }}>
    {/* Ambient glow orbs */}
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-glow-pulse" />
      <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px] animate-glow-pulse" />
      <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] bg-primary/8 rounded-full blur-[100px] animate-glow-pulse" />
    </div>
    <Navbar />
    <main className="flex-1 relative z-10">
      <Outlet />
    </main>
    <Footer />
    <WhatsAppButton />
  </div>
);
