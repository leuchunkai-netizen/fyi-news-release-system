import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUserWithInterests, signOut as authSignOut } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

export type UserRole = "guest" | "free" | "premium" | "expert" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  gender?: string;
  age?: number;
  location?: string;
  interests?: string[];
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function profileToUser(
  profile: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string | null;
    gender?: string | null;
    age?: number | null;
    location?: string | null;
  },
  interests: string[]
): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatar: profile.avatar ?? undefined,
    gender: profile.gender ?? undefined,
    age: profile.age ?? undefined,
    location: profile.location ?? undefined,
    interests: interests.length ? interests : undefined,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      getCurrentUserWithInterests()
        .then((data) => {
          if (!mounted) return;
          if (data) setUser(profileToUser(data.profile, data.interests));
          else setUser(null);
        })
        .catch(() => {
          if (mounted) setUser(null);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    };

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "TOKEN_REFRESHED") return;
      setLoading(true);
      load();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await authSignOut();
    setUser(null);
    // Redirect to login page after logout to match admin/logout flow diagrams.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
