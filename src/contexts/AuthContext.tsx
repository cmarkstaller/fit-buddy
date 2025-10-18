import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  UserProfile,
  WeightEntry,
  createUser,
  authenticateUser,
  setCurrentUser,
  getCurrentUser,
  saveUserProfile,
  getUserProfile,
  addWeightEntry,
  signOut as localSignOut,
} from "../lib/localStorage";
import { mockWeightEntries, DEMO_USER_ID_FOR_WEIGHTS } from "../data/weights";

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
    // Check for existing user session
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const profile = getUserProfile(currentUser.id);
      setUserProfile(profile);
      // For demo purposes, load weight entries from mock data instead of storage
      setWeightEntries(
        mockWeightEntries
          .map((entry) => ({ ...entry, user_id: currentUser.id })) // Map to current user
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
      );
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string) => {
    const { user: newUser, error } = createUser(email, password);
    if (error) {
      return { error: { message: error } };
    }

    setCurrentUser(newUser);
    setUser(newUser);
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { user: authUser, error } = authenticateUser(email, password);
    if (error) {
      return { error: { message: error } };
    }

    setCurrentUser(authUser);
    setUser(authUser);

    // Load user profile and weight entries
    if (authUser) {
      const profile = getUserProfile(authUser.id);
      setUserProfile(profile);
      // For demo purposes, load weight entries from mock data instead of storage
      setWeightEntries(
        mockWeightEntries
          .map((entry) => ({ ...entry, user_id: authUser.id })) // Map to current user
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
      );
    }

    return { error: null };
  };

  const signOut = async () => {
    localSignOut();
    setUser(null);
    setUserProfile(null);
    setWeightEntries([]);
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
