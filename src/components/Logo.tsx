import { Link } from "react-router-dom";

const logoImg = "/logo.png";

export const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center group ${className}`}>
    <img
      src={logoImg}
      alt="TIBA DIGITAL"
      className="h-11 w-auto max-w-[160px] object-contain drop-shadow-[0_0_18px_rgba(236,72,153,0.35)] transition-transform duration-300 group-hover:scale-[1.02]"
    />
  </Link>
);
