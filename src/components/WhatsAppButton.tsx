import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5491161369030"; // Reemplazar con el número real
const WHATSAPP_MESSAGE = "¡Hola! Quiero consultar sobre un producto en TIBADIGITAL 🎮";

export const WhatsAppButton = () => (
  <a
    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Contactar por WhatsApp"
    className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-[#25D366]/30 transition-all hover:scale-130 hover:shadow-xl hover:shadow-[#25D366]/40 animate-fade-in"
  >
    <img src="wp.svg" alt="whatsapp" className="h-14 w-14" />
  </a>
);
