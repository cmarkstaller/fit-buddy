import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  UserProfile,
  WeightEntry,
  setCurrentUser,
  saveUserProfile,
  getUserProfile,
} from "../lib/localStorage";
import { mockWeightEntries } from "../data/weights";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error: any }>;
  addWeight: (weight: number, notes?: string) => Promise<{ error: any }>;
  weightEntries: WeightEntry[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch weights from Supabase and hydrate userProfile
  const hydrateProfileFromSupabase = async (userId: string) => {
    const existing = getUserProfile(userId);
    const { data, error } = await supabase
      .from("user_starting_weights")
      .select("starting_weight_lbs, target_weight_lbs")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to fetch weights from Supabase:", error.message);
    }

    if (!existing && !data) {
      setUserProfile(null);
      return;
    }

    const merged: UserProfile = {
      id: existing?.id || Date.now().toString(36),
      user_id: userId,
      starting_weight:
        (data?.starting_weight_lbs as number | undefined) ??
        existing?.starting_weight ??
        0,
      target_weight:
        (data?.target_weight_lbs as number | undefined) ??
        existing?.target_weight ??
        0,
      height: existing?.height ?? 0,
      age: existing?.age ?? 0,
      activity_level: existing?.activity_level ?? "moderate",
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUserProfile(merged);
  };

  useEffect(() => {
    // Check for existing Supabase session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const appUser: User = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at,
        };
        setUser(appUser);
        setCurrentUser(appUser); // Store in localStorage for compatibility

        await hydrateProfileFromSupabase(appUser.id);

        // For demo purposes, load weight entries from mock data
        setWeightEntries(
          mockWeightEntries
            .map((entry) => ({ ...entry, user_id: appUser.id }))
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );
      }

      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const appUser: User = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at,
        };
        setUser(appUser);
        setCurrentUser(appUser);

        hydrateProfileFromSupabase(appUser.id);
      } else {
        setUser(null);
        setUserProfile(null);
        setWeightEntries([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { error: { message: error.message } };
    }

    if (data.user) {
      const appUser: User = {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at,
      };
      setUser(appUser);
      setCurrentUser(appUser);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: { message: error.message } };
    }

    if (data.user) {
      const appUser: User = {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at,
      };
      setUser(appUser);
      setCurrentUser(appUser);

      // Load user profile hydrated from Supabase
      await hydrateProfileFromSupabase(appUser.id);

      // For demo purposes, load weight entries from mock data
      setWeightEntries(
        mockWeightEntries
          .map((entry) => ({ ...entry, user_id: appUser.id }))
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
      );
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear local state is handled by the auth state change listener
  };

  const updateProfile = async (profile: Partial<UserProfile>) => {
    if (!user) {
      return { error: { message: "No user logged in" } };
    }

    const { profile: savedProfile, error } = saveUserProfile(user.id, profile);
    if (error) {
      return { error: { message: error } };
    }

    // Store starting and target weights to Supabase (upsert, owner RLS enforced)
    const startingCandidate =
      typeof profile.starting_weight === "number" &&
      Number.isFinite(profile.starting_weight)
        ? profile.starting_weight
        : savedProfile?.starting_weight;
    const targetCandidate =
      typeof profile.target_weight === "number" &&
      Number.isFinite(profile.target_weight)
        ? profile.target_weight
        : savedProfile?.target_weight;

    const hasEither =
      typeof startingCandidate === "number" ||
      typeof targetCandidate === "number";

    if (hasEither) {
      const payload: Record<string, any> = { user_id: user.id };

      if (typeof startingCandidate === "number") {
        const roundedStart = Math.round(startingCandidate * 10) / 10;
        const normalizedStart = Math.min(1000, Math.max(0, roundedStart));
        payload.starting_weight_lbs = normalizedStart;
      }

      if (typeof targetCandidate === "number") {
        const roundedTarget = Math.round(targetCandidate * 10) / 10;
        const normalizedTarget = Math.min(1000, Math.max(0, roundedTarget));
        payload.target_weight_lbs = normalizedTarget;
      }

      const { error: upsertError } = await supabase
        .from("user_starting_weights")
        .upsert(payload, { onConflict: "user_id" });
      if (upsertError) {
        // eslint-disable-next-line no-console
        console.warn(
          "Failed to upsert starting/target weight:",
          upsertError.message
        );
      }
    }

    setUserProfile(savedProfile);
    return { error: null };
  };

  const addWeight = async (weight: number, notes?: string) => {
    if (!user) {
      return { error: { message: "No user logged in" } };
    }

    // Update in-memory mock list for demo
    const newEntry: WeightEntry = {
      id: Date.now().toString(36),
      user_id: user.id,
      weight,
      date: new Date().toISOString().split("T")[0],
      notes: notes || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setWeightEntries((prev) => [newEntry, ...prev]);

    return { error: null };
  };

  const value = {
    user,
    userProfile,
    weightEntries,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    addWeight,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
