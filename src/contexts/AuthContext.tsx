import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  UserProfile,
  WeightEntry,
  setCurrentUser,
  getCurrentUser,
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

  useEffect(() => {
    // Check for existing Supabase session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const appUser: User = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at,
        };
        setUser(appUser);
        setCurrentUser(appUser); // Store in localStorage for compatibility
        
        const profile = getUserProfile(appUser.id);
        setUserProfile(profile);
        
        // For demo purposes, load weight entries from mock data
        setWeightEntries(
          mockWeightEntries
            .map((entry) => ({ ...entry, user_id: appUser.id }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      }
      
      setLoading(false);
    };
    
    checkSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const appUser: User = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at,
        };
        setUser(appUser);
        setCurrentUser(appUser);
        
        const profile = getUserProfile(appUser.id);
        setUserProfile(profile);
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

      // Load user profile and weight entries
      const profile = getUserProfile(appUser.id);
      setUserProfile(profile);
      
      // For demo purposes, load weight entries from mock data
      setWeightEntries(
        mockWeightEntries
          .map((entry) => ({ ...entry, user_id: appUser.id }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
