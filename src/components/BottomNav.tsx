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
          className={`flex items-center justify-center py-4 ${
            isActive("/dashboard")
              ? "text-[rgb(60,96,96)]"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label="Dashboard"
        >
          <Home className="h-7 w-7" />
        </Link>
        <Link
          to="/shared"
          className={`flex items-center justify-center py-4 ${
            isActive("/shared")
              ? "text-[rgb(60,96,96)]"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label="Shared"
        >
          <Users className="h-7 w-7" />
        </Link>
      </div>
    </nav>
  );
}
