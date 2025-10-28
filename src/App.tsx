import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { ProfileSetup } from "./components/ProfileSetup";
import { WeightDashboard } from "./components/WeightDashboard";
import { SharedDashboard } from "./components/SharedDashboard";
import { BottomNav } from "./components/BottomNav";
import { Settings } from "./components/Settings";

function AppRoutes() {
  const { user, loading, onboardingNeeded } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthForm />;

  if (onboardingNeeded) return <ProfileSetup />;

  return (
    <div className="pb-16">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<WeightDashboard />} />
        <Route path="/shared" element={<SharedDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
