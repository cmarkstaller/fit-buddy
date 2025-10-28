import { Link, useLocation } from "react-router-dom";
import { Home, Users } from "lucide-react";

export function BottomNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t shadow-sm z-10">
      <div className="max-w-4xl mx-auto grid grid-cols-2">
        <Link
          to="/dashboard"
          className={`flex items-center justify-center py-3 space-x-2 ${
            isActive("/dashboard")
              ? "text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-sm font-medium">My Dashboard</span>
        </Link>
        <Link
          to="/shared"
          className={`flex items-center justify-center py-3 space-x-2 ${
            isActive("/shared")
              ? "text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-sm font-medium">Shared</span>
        </Link>
      </div>
    </nav>
  );
}
