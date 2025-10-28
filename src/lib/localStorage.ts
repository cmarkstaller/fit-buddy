// Simple localStorage-based authentication and data storage
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  starting_weight: number;
  target_weight: number;
  height: number;
  age: number;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  username?: string;
  friend_code?: string;
  created_at: string;
  updated_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Storage keys
const STORAGE_KEYS = {
  USERS: "fitbuddy_users",
  PROFILES: "fitbuddy_profiles",
  WEIGHT_ENTRIES: "fitbuddy_weight_entries",
  CURRENT_USER: "fitbuddy_current_user",
};

// Helper functions for localStorage
const getStorageData = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const setStorageData = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

// Generate unique IDs
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// User management
export const createUser = (
  email: string,
  password: string
): { user: User; error: string | null } => {
  const users = getStorageData<User & { password: string }>(STORAGE_KEYS.USERS);

  // Check if user already exists
  if (users.find((u) => u.email === email)) {
    return { user: null as any, error: "User already exists" };
  }

  const user: User = {
    id: generateId(),
    email,
    created_at: new Date().toISOString(),
  };

  users.push({ ...user, password });
  setStorageData(STORAGE_KEYS.USERS, users);

  return { user, error: null };
};

export const authenticateUser = (
  email: string,
  password: string
): { user: User | null; error: string | null } => {
  const users = getStorageData<User & { password: string }>(STORAGE_KEYS.USERS);
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return { user: null, error: "Invalid email or password" };
  }

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, error: null };
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

export const getCurrentUser = (): User | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

// Profile management
export const saveUserProfile = (
  userId: string,
  profile: Partial<UserProfile>
): { profile: UserProfile | null; error: string | null } => {
  const profiles = getStorageData<UserProfile>(STORAGE_KEYS.PROFILES);
  const existingProfile = profiles.find((p) => p.user_id === userId);

  const profileData: UserProfile = {
    id: existingProfile?.id || generateId(),
    user_id: userId,
    starting_weight: profile.starting_weight!,
    target_weight: profile.target_weight!,
    height: profile.height!,
    age: profile.age!,
    activity_level: profile.activity_level!,
    created_at: existingProfile?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingProfile) {
    const index = profiles.findIndex((p) => p.id === existingProfile.id);
    profiles[index] = profileData;
  } else {
    profiles.push(profileData);
  }

  setStorageData(STORAGE_KEYS.PROFILES, profiles);
  return { profile: profileData, error: null };
};

export const getUserProfile = (userId: string): UserProfile | null => {
  const profiles = getStorageData<UserProfile>(STORAGE_KEYS.PROFILES);
  return profiles.find((p) => p.user_id === userId) || null;
};

// Weight entries management
export const addWeightEntry = (
  userId: string,
  weight: number,
  notes?: string
): { entry: WeightEntry | null; error: string | null } => {
  const entries = getStorageData<WeightEntry>(STORAGE_KEYS.WEIGHT_ENTRIES);

  const entry: WeightEntry = {
    id: generateId(),
    user_id: userId,
    weight,
    date: new Date().toISOString().split("T")[0],
    notes: notes || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  entries.push(entry);
  setStorageData(STORAGE_KEYS.WEIGHT_ENTRIES, entries);

  return { entry, error: null };
};

export const getWeightEntries = (userId: string): WeightEntry[] => {
  const entries = getStorageData<WeightEntry>(STORAGE_KEYS.WEIGHT_ENTRIES);
  return entries
    .filter((e) => e.user_id === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const signOut = (): void => {
  setCurrentUser(null);
};
