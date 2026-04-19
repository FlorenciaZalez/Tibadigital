import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCountry, type CountryCode } from "@/lib/currency";

export type UserType = "client" | "reseller";

const GUEST_COUNTRY_KEY = "tiba_guest_country";

const getGuestCountry = (): CountryCode => {
  try {
    const stored = localStorage.getItem(GUEST_COUNTRY_KEY);
    if (stored) return normalizeCountry(stored);
  } catch {}
  return "AR";
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  country: CountryCode;
  setCountry: (c: CountryCode) => void;
  userType: UserType;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  country: "AR",
  setCountry: () => {},
  userType: "client",
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [country, setCountryState] = useState<CountryCode>(getGuestCountry);
  const [userType, setUserType] = useState<UserType>("client");
  const [loading, setLoading] = useState(true);

  const setCountry = useCallback((c: CountryCode) => {
    setCountryState(c);
    try { localStorage.setItem(GUEST_COUNTRY_KEY, c); } catch {}
  }, []);

  useEffect(() => {
    // Set listener BEFORE getSession (avoid race conditions)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user?.user_metadata?.country) {
        setCountry(normalizeCountry(newSession.user.user_metadata.country as string));
      }
      setUserType((newSession?.user?.user_metadata?.user_type as UserType) || "client");
      if (newSession?.user) {
        // Defer role fetch to avoid deadlock
        setTimeout(() => checkAdminRole(newSession.user.id), 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user?.user_metadata?.country) {
        setCountry(normalizeCountry(existing.user.user_metadata.country as string));
      }
      setUserType((existing?.user?.user_metadata?.user_type as UserType) || "client");
      if (existing?.user) {
        checkAdminRole(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, country, setCountry, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
