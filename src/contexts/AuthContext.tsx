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
  getWeightEntries,
  signOut as localSignOut,
} from "../lib/localStorage";

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
      if (profile) {
        const entries = getWeightEntries(currentUser.id);
        setWeightEntries(entries);
      }
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
      if (profile) {
        const entries = getWeightEntries(authUser.id);
        setWeightEntries(entries);
      }
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

    const { entry, error } = addWeightEntry(user.id, weight, notes);
    if (error) {
      return { error: { message: error } };
    }

    // Update local state
    const entries = getWeightEntries(user.id);
    setWeightEntries(entries);

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
