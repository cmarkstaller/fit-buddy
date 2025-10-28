import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  Users,
  TrendingUp,
  Menu,
  X,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { format, parseISO, subDays, subMonths, subYears } from "date-fns";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function SharedDashboard() {
  const { user, signOut } = useAuth();
  const [timePeriod, setTimePeriod] = useState<
    "week" | "month" | "year" | "all"
  >("month");
  const [friendCode, setFriendCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load real data: me + friends (requires RLS policy below)
  const [datasets, setDatasets] = useState<any[]>([]);
  const [friendCards, setFriendCards] = useState<
    {
      userId: string;
      username: string;
      current: number | null;
      change30d: number | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Close menu on outside click
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1) Get friend user ids (either direction)
      const { data: friends, error: fErr } = await supabase
        .from("user_friends")
        .select("user_id, friend_user_id")
        .or(`user_id.eq.${user.id},friend_user_id.eq.${user.id}`);
      if (fErr) throw fErr;
      const friendIds = (friends || []).map((r: any) =>
        r.user_id === user.id ? r.friend_user_id : r.user_id
      );
      const allIds = [user.id, ...Array.from(new Set(friendIds))];

      // 2) Fetch weight entries for me + friends
      const { data: weights, error: wErr } = await supabase
        .from("user_weight_entries")
        .select("user_id, entry_date, weight_lbs")
        .in("user_id", allIds.length > 0 ? allIds : [user.id])
        .order("entry_date", { ascending: true });
      if (wErr) throw wErr;

      // 3) Fetch usernames for labels/cards
      const { data: profiles, error: pErr } = await supabase
        .from("user_profiles")
        .select("user_id, username")
        .in("user_id", allIds);
      if (pErr) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load profiles:", pErr.message);
      }
      const idToName = new Map<string, string>();
      (profiles || []).forEach((r: any) => {
        const name = r.username || "Friend";
        idToName.set(r.user_id, name);
      });
      idToName.set(user.id, idToName.get(user.id) || "Me");

      // 4) Group by user and build datasets + cards
      const byUser = new Map<string, { x: string; y: number }[]>();
      (weights || []).forEach((row: any) => {
        const arr = byUser.get(row.user_id) || [];
        arr.push({ x: row.entry_date, y: Number(row.weight_lbs) });
        byUser.set(row.user_id, arr);
      });

      const palette = [
        { border: "#2563EB", bg: "rgba(37,99,235,0.1)", label: "Me" },
        { border: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Friend 1" },
        { border: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "Friend 2" },
        { border: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Friend 3" },
      ];

      const built: any[] = [];
      const cards: {
        userId: string;
        username: string;
        current: number | null;
        change30d: number | null;
      }[] = [];
      allIds.forEach((id, idx) => {
        const pts = byUser.get(id) || [];
        const p = palette[Math.min(idx, palette.length - 1)];
        const fallback = `${id.slice(0, 8)}…`;
        const labelBase = id === user.id ? "Me" : idToName.get(id) || fallback;
        const label = `${labelBase} (lbs)`;
        built.push({
          label,
          data: pts,
          borderColor: p.border,
          backgroundColor: p.bg,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.2,
        });

        // Card stats: current and 30d change
        let current: number | null = null;
        let change30d: number | null = null;
        if (pts.length > 0) {
          current = pts[pts.length - 1].y;
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const prior = [...pts]
            .reverse()
            .find((pt) => new Date(pt.x) <= cutoff);
          if (prior) change30d = Number((current - prior.y).toFixed(1));
        }
        if (id !== user.id) {
          cards.push({ userId: id, username: labelBase, current, change30d });
        }
      });
      setDatasets(built);
      setFriendCards(cards);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  // Filter datasets by selected time period
  const filteredDatasets = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    switch (timePeriod) {
      case "week":
        cutoff = subDays(now, 7);
        break;
      case "month":
        cutoff = subMonths(now, 1);
        break;
      case "year":
        cutoff = subYears(now, 1);
        break;
      default:
        cutoff = new Date(0);
    }
    return datasets.map((ds) => ({
      ...ds,
      data: (ds.data || []).filter((pt: any) => new Date(pt.x) >= cutoff),
    }));
  }, [datasets, timePeriod]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.8)",
          titleColor: "white",
          bodyColor: "white",
          callbacks: {
            title(context: any) {
              return format(parseISO(context[0].raw.x), "MMM d, yyyy");
            },
            label(context: any) {
              const y = Number(context.parsed.y);
              return `${context.dataset.label}: ${
                Number.isFinite(y) ? y.toFixed(1) : context.parsed.y
              } lbs`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time" as const,
          time: {
            unit: (timePeriod === "week"
              ? "day"
              : timePeriod === "month"
              ? "week"
              : timePeriod === "year"
              ? "month"
              : "month") as "day" | "week" | "month",
            displayFormats: {
              day: "EEE d",
              week: "MMM d",
              month: "MMM yyyy",
              year: "yyyy",
            },
            tooltipFormat: "MMM d, yyyy",
          },
          grid: {
            display: true,
            color: "rgba(107, 114, 128, 0.15)",
            lineWidth: 1,
            drawOnChartArea: true,
          },
          ticks: {
            color: "#6B7280",
            font: { size: 12 },
          },
        },
        y: {
          grid: { color: "rgba(107,114,128,0.1)" },
          ticks: {
            color: "#6B7280",
            font: { size: 12 },
            callback: (v: any) => {
              const n = Number(v);
              return `${Number.isFinite(n) ? n.toFixed(1) : v} lbs`;
            },
            maxTicksLimit: 6,
          },
        },
      },
    }),
    [timePeriod]
  );

  return (
    <div className="min-h-screen pb-16">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-[rgb(60,96,96)] rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Shared Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Compare progress with friends
              </p>
            </div>
          </div>
          {/* Hamburger Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              aria-label="Open menu"
            >
              {showMenu ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <a
                  href="/settings"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </a>
                <button
                  onClick={signOut}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-gray-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Weight Comparison
            </h3>
          </div>
          <div className="h-80">
            <Line
              data={{ datasets: filteredDatasets }}
              options={options as any}
            />
          </div>
        </div>

        {/* Time Period Filter Bar */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-200 rounded-full px-2 py-2 inline-flex items-center gap-2">
            <button
              onClick={() => setTimePeriod("week")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timePeriod === "week"
                  ? "bg-[rgb(60,96,96)] text-white"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimePeriod("month")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timePeriod === "month"
                  ? "bg-[rgb(60,96,96)] text-white"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setTimePeriod("year")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timePeriod === "year"
                  ? "bg-[rgb(60,96,96)] text-white"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              Year
            </button>
            <button
              onClick={() => setTimePeriod("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timePeriod === "all"
                  ? "bg-[rgb(60,96,96)] text-white"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Friend Cards */}
          {friendCards.map((f) => (
            <div key={f.userId} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-600">{f.username}</p>
              <p className="text-2xl font-bold text-gray-900">
                {f.current != null ? `${f.current.toFixed(1)} lbs` : "--"}
              </p>
              <p
                className={`text-sm mt-1 ${
                  (f.change30d ?? 0) >= 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                30d:{" "}
                {f.change30d != null && !Number.isNaN(f.change30d)
                  ? `${f.change30d > 0 ? "+" : ""}${f.change30d} lbs`
                  : "--"}
              </p>
            </div>
          ))}

          {/* Add Friend Button Card */}
          <button
            onClick={() => setShowAddFriendModal(true)}
            className="bg-white rounded-xl shadow-sm p-4 border-2 border-dashed border-gray-300 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[120px] text-gray-600 hover:text-[rgb(60,96,96)]"
          >
            <Plus className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Add Friend</p>
          </button>
        </div>

        {/* Add Friend Modal */}
        {showAddFriendModal && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-sm p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add a Friend
                </h3>
                <button
                  onClick={() => {
                    setShowAddFriendModal(false);
                    setMessage(null);
                    setFriendCode("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Friend Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter friend code (e.g., ABC123)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={friendCode}
                    onChange={(e) =>
                      setFriendCode(e.target.value.toUpperCase())
                    }
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    disabled={adding || !friendCode.trim()}
                    onClick={async () => {
                      if (!user) return;
                      setAdding(true);
                      setMessage(null);
                      try {
                        const code = friendCode.trim();
                        if (code.length !== 6) {
                          setMessage("Friend code should be 6 characters.");
                          setAdding(false);
                          return;
                        }
                        // 1) Lookup friend by code via RPC (bypasses RLS safely)
                        const { data: friendUserId, error: findErr } =
                          await supabase.rpc("get_user_id_by_friend_code", {
                            p_code: code,
                          });
                        if (findErr) throw findErr;
                        if (!friendUserId) {
                          setMessage("No user found with that code.");
                          setAdding(false);
                          return;
                        }
                        if (friendUserId === user.id) {
                          setMessage("You can't add yourself.");
                          setAdding(false);
                          return;
                        }

                        // 2) Insert relation (skip approval)
                        const { error: insertErr } = await supabase
                          .from("user_friends")
                          .upsert(
                            {
                              user_id: user.id,
                              friend_user_id: friendUserId,
                            },
                            { onConflict: "user_id,friend_user_id" }
                          );
                        if (insertErr) throw insertErr;

                        setMessage("Friend added!");
                        setFriendCode("");
                        // Reload dashboard data to show the new friend
                        await loadDashboardData();
                        // Close modal after successful add
                        setTimeout(() => {
                          setShowAddFriendModal(false);
                          setMessage(null);
                        }, 1000);
                      } catch (e: any) {
                        // eslint-disable-next-line no-console
                        console.warn(e?.message || e);
                        setMessage(e?.message || "Failed to add friend.");
                      } finally {
                        setAdding(false);
                      }
                    }}
                    className="flex-1 bg-[rgb(60,96,96)] text-white px-6 py-2 rounded-lg font-medium hover:bg-[rgb(45,75,75)] focus:outline-none focus:ring-2 focus:ring-[rgb(60,96,96)] focus:ring-offset-2 disabled:opacity-50"
                  >
                    {adding ? "Adding..." : "Add Friend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFriendModal(false);
                      setMessage(null);
                      setFriendCode("");
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </div>
                {message && (
                  <div
                    className={`text-sm p-3 rounded ${
                      message.includes("added")
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
