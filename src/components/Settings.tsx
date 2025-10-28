import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function Settings() {
  const { userProfile } = useAuth();
  const friendCode = (userProfile as any)?.friend_code as string | undefined;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[rgb(159,137,103)]">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 -ml-2 rounded-md text-[rgb(60,96,96)] hover:text-[rgb(52,84,84)] focus:outline-none focus:ring-2 focus:ring-[rgb(60,96,96)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Friend Code
          </h2>
          {friendCode ? (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
              <span className="font-mono text-lg tracking-wider text-gray-900">
                {friendCode}
              </span>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">
              Your friend code will appear here after you complete your profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
