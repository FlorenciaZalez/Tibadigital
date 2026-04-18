import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCountry, type CountryCode } from "@/lib/currency";

export type UserType = "client" | "reseller";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  country: CountryCode;
  userType: UserType;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  country: "AR",
  userType: "client",
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [country, setCountry] = useState<CountryCode>("AR");
  const [userType, setUserType] = useState<UserType>("client");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set listener BEFORE getSession (avoid race conditions)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setCountry(normalizeCountry(newSession?.user?.user_metadata?.country as string | undefined));
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
      setCountry(normalizeCountry(existing?.user?.user_metadata?.country as string | undefined));
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
    <AuthContext.Provider value={{ session, user, isAdmin, country, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
