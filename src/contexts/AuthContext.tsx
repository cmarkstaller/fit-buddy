import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  UserProfile,
  WeightEntry,
  setCurrentUser,
  saveUserProfile,
  getUserProfile,
} from "../lib/localStorage";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  onboardingNeeded: boolean;
  completeOnboarding: () => void;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (
    profile: Partial<UserProfile> & { username?: string }
  ) => Promise<{ error: any }>;
  addWeight: (weight: number, notes?: string) => Promise<{ error: any }>;
  weightEntries: WeightEntry[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboardingNeeded, setOnboardingNeeded] = useState(false);
  const [pendingFriendCode, setPendingFriendCode] = useState<string | null>(
    null
  );
  const completeOnboarding = () => setOnboardingNeeded(false);

  // Fetch weights from Supabase and hydrate userProfile
  const hydrateProfileFromSupabase = async (userId: string) => {
    const existing = getUserProfile(userId);
    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "starting_weight_lbs, target_weight_lbs, height_in, age, activity_level, username, friend_code"
      )
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

    // Do not enforce required fields here; login should not flash onboarding

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
      height: (data?.height_in as number | undefined) ?? existing?.height ?? 0,
      age: (data?.age as number | undefined) ?? existing?.age ?? 0,
      activity_level: ((): UserProfile["activity_level"] => {
        const fromDb = data?.activity_level as string | undefined;
        const allowed: UserProfile["activity_level"][] = [
          "sedentary",
          "light",
          "moderate",
          "active",
          "very_active",
        ];
        if (fromDb && (allowed as string[]).includes(fromDb)) {
          return fromDb as UserProfile["activity_level"];
        }
        return existing?.activity_level ?? "moderate";
      })(),
      username: (data?.username as string | undefined) ?? existing?.username,
      friend_code:
        (data?.friend_code as string | undefined) ?? existing?.friend_code,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUserProfile(merged);
  };

  // Load all weight entries for the user from Supabase
  const loadAllWeightEntries = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_weight_entries")
      .select("id, entry_date, weight_lbs, notes, created_at, updated_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to load weight entries:", error.message);
      return;
    }

    const mapped: WeightEntry[] = (data || []).map((row: any) => ({
      id: row.id as string,
      user_id: userId,
      weight: Number(row.weight_lbs),
      date: row.entry_date as string,
      notes: (row.notes as string | null) ?? undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));

    setWeightEntries(mapped);
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
        // Load weight entries from DB
        await loadAllWeightEntries(appUser.id);
        // Normal session restore: default to not needing onboarding
        setOnboardingNeeded(false);

        // Load real weight entries
        await loadAllWeightEntries(appUser.id);
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
        loadAllWeightEntries(appUser.id);
      } else {
        setUser(null);
        setUserProfile(null);
        setWeightEntries([]);
        setOnboardingNeeded(false);
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
      // Newly signed up users should go through onboarding
      setOnboardingNeeded(true);
      // Clear any stale profile to ensure ProfileSetup shows without flicker
      setUserProfile(null);
      // Generate a 6-char friend code and hold it until profile save
      const friendCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      setPendingFriendCode(friendCode);
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
      // Load weight entries from DB
      await loadAllWeightEntries(appUser.id);
      // Login flow should not show onboarding by default
      setOnboardingNeeded(false);

      await loadAllWeightEntries(appUser.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    // Always attempt remote sign-out, but clear local state regardless
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Supabase signOut failed or no session; clearing locally.");
    } finally {
      // Proactively clear local app state so user can fully sign out even if auth timed out
      setUser(null);
      setUserProfile(null);
      setWeightEntries([]);
      setOnboardingNeeded(false);
      setCurrentUser(null);
    }
  };

  const updateProfile = async (
    profile: Partial<UserProfile> & { username?: string }
  ) => {
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
    const heightCandidate =
      typeof profile.height === "number" && Number.isFinite(profile.height)
        ? profile.height
        : savedProfile?.height;
    const ageCandidate =
      typeof profile.age === "number" && Number.isFinite(profile.age)
        ? profile.age
        : savedProfile?.age;
    const activityCandidate =
      profile.activity_level || savedProfile?.activity_level;
    const usernameCandidate = profile.username;

    const hasAny =
      typeof startingCandidate === "number" ||
      typeof targetCandidate === "number" ||
      typeof heightCandidate === "number" ||
      typeof ageCandidate === "number" ||
      typeof activityCandidate === "string";

    if (hasAny) {
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

      if (typeof heightCandidate === "number") {
        const normalizedHeight = Math.min(120, Math.max(0, heightCandidate));
        payload.height_in = normalizedHeight;
      }

      if (typeof ageCandidate === "number") {
        const normalizedAge = Math.min(120, Math.max(0, ageCandidate));
        payload.age = normalizedAge;
      }

      if (typeof activityCandidate === "string") {
        payload.activity_level = activityCandidate;
      }

      if (
        typeof usernameCandidate === "string" &&
        usernameCandidate.length > 0
      ) {
        payload.username = usernameCandidate;
      }

      // Attach friend_code: prefer existing from hydrated profile, else pending, else generate
      if ((userProfile as any)?.friend_code) {
        payload.friend_code = (userProfile as any).friend_code;
      } else if (pendingFriendCode) {
        payload.friend_code = pendingFriendCode;
      } else {
        payload.friend_code = Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase();
      }

      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (upsertError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to upsert profile:", upsertError.message);
      }
      // Clear pending friend code once persisted
      setPendingFriendCode(null);
    }

    setUserProfile(savedProfile);
    return { error: null };
  };

  const addWeight = async (weight: number, notes?: string) => {
    if (!user) {
      return { error: { message: "No user logged in" } };
    }

    // Normalize and upsert to DB
    const rounded = Math.round(weight * 10) / 10;
    const normalized = Math.min(1000, Math.max(0, rounded));
    const today = new Date().toISOString().split("T")[0];

    const { error: dbError } = await supabase
      .from("user_weight_entries")
      .upsert(
        {
          user_id: user.id,
          entry_date: today,
          weight_lbs: normalized,
          notes: notes || null,
        },
        { onConflict: "user_id,entry_date" }
      );
    if (dbError) {
      // eslint-disable-next-line no-console
      console.warn("Failed to upsert weight entry:", dbError.message);
    }

    // Update local state for responsiveness
    const newEntry: WeightEntry = {
      id: Date.now().toString(36),
      user_id: user.id,
      weight: normalized,
      date: today,
      notes: notes || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setWeightEntries((prev) => [
      newEntry,
      ...prev.filter((e) => e.date !== today),
    ]);

    return { error: null };
  };

  const value = {
    user,
    userProfile,
    weightEntries,
    loading,
    onboardingNeeded,
    completeOnboarding,
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
