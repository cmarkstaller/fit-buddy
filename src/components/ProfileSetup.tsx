import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../lib/localStorage";
import { Scale, Target, Ruler, Calendar, Activity } from "lucide-react";

export function ProfileSetup() {
  const { updateProfile, completeOnboarding, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    username: "",
    starting_weight: "",
    target_weight: "",
    height: "",
    age: "",
    activity_level: "moderate" as UserProfile["activity_level"],
  });

  const activityLevels = [
    { value: "sedentary", label: "Sedentary (little to no exercise)" },
    { value: "light", label: "Light (light exercise 1-3 days/week)" },
    { value: "moderate", label: "Moderate (moderate exercise 3-5 days/week)" },
    { value: "active", label: "Active (hard exercise 6-7 days/week)" },
    {
      value: "very_active",
      label: "Very Active (very hard exercise, physical job)",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const profileData = {
      username: formData.username.trim(),
      starting_weight: parseFloat(formData.starting_weight),
      target_weight: parseFloat(formData.target_weight),
      height: parseFloat(formData.height),
      age: parseInt(formData.age),
      activity_level: formData.activity_level,
    } as const;

    // Validate data
    if (
      isNaN(profileData.starting_weight) ||
      isNaN(profileData.target_weight) ||
      isNaN(profileData.height) ||
      isNaN(profileData.age)
    ) {
      setError("Please enter valid numbers for all fields");
      setLoading(false);
      return;
    }

    try {
      const result = await updateProfile(profileData);

      if (result.error) {
        setError(result.error.message || "Failed to save profile");
      } else {
        // Mark onboarding complete and route to dashboard
        completeOnboarding();
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center p-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 bg-[rgb(60,96,96)] rounded-full flex items-center justify-center mb-4">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Set Up Your Profile
            </h1>
            <p className="text-gray-600">
              Tell us about yourself to personalize your weight tracking
              experience
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., chrisfit"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scale className="inline h-4 w-4 mr-2" />
                  Starting Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={1000}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="150.0"
                  value={formData.starting_weight}
                  onChange={(e) =>
                    handleChange("starting_weight", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="inline h-4 w-4 mr-2" />
                  Target Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="140.0"
                  value={formData.target_weight}
                  onChange={(e) =>
                    handleChange("target_weight", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Ruler className="inline h-4 w-4 mr-2" />
                  Height (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="65.0"
                  value={formData.height}
                  onChange={(e) => handleChange("height", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-2" />
                  Age
                </label>
                <input
                  type="number"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Activity className="inline h-4 w-4 mr-2" />
                Activity Level
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.activity_level}
                onChange={(e) => handleChange("activity_level", e.target.value)}
              >
                {activityLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[rgb(60,96,96)] text-white py-3 px-4 rounded-lg font-medium hover:bg-[rgb(52,84,84)] focus:outline-none focus:ring-2 focus:ring-[rgb(60,96,96)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
