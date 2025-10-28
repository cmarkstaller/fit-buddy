import { useEffect, useMemo, useState } from "react";
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
import { Users, TrendingUp } from "lucide-react";
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
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState<
    "week" | "month" | "year" | "all"
  >("month");
  const [friendCode, setFriendCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  const [friendIdsDebug, setFriendIdsDebug] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
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
        setFriendIdsDebug(Array.from(new Set(friendIds)));
        if ((friendIds || []).length === 0) {
          setMessage("No friends found or no access to friend list.");
        } else {
          setMessage(null);
        }
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
        const profileDbg: string[] = [];
        (profiles || []).forEach((r: any) => {
          const name = r.username || "Friend";
          idToName.set(r.user_id, name);
          profileDbg.push(`  ${r.user_id} -> ${name}`);
        });
        idToName.set(user.id, idToName.get(user.id) || "Me");
        setMessage(
          `Profiles loaded:\n${
            profileDbg.length > 0 ? profileDbg.join("\n") : "  (none)"
          }`
        );

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
          const labelBase =
            id === user.id ? "Me" : idToName.get(id) || fallback;
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
    load();
  }, [user]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            title(context: any) {
              return context[0].raw.x;
            },
            label(context: any) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(
                1
              )} lbs`;
            },
          },
        },
      },
      scales: {
        x: { type: "time" as const, grid: { display: false } },
        y: {
          grid: { color: "rgba(107,114,128,0.1)" },
          ticks: { callback: (v: any) => `${v} lbs` },
        },
      },
    }),
    []
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
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {friendIdsDebug.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-4 text-sm">
            <p className="font-medium mb-1">Debug: Friend UIDs</p>
            <pre className="whitespace-pre-wrap break-all">
              {friendIdsDebug.join("\n")}
            </pre>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Weight Comparison
            </h3>
            <div className="text-sm text-gray-600">(Dummy data for now)</div>
          </div>
          <div className="h-80">
            <Line data={{ datasets }} options={options as any} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {friendCards.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-600">No friends yet</p>
              <p className="text-gray-900">Add a friend to compare stats.</p>
            </div>
          ) : (
            friendCards.map((f) => (
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
            ))
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add a Friend
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter friend code (e.g., ABC123)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
            />
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
                } catch (e: any) {
                  // eslint-disable-next-line no-console
                  console.warn(e?.message || e);
                  setMessage(e?.message || "Failed to add friend.");
                } finally {
                  setAdding(false);
                }
              }}
              className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Friend"}
            </button>
          </div>
          {message && (
            <pre className="mt-3 text-xs text-gray-700 bg-gray-50 p-2 rounded whitespace-pre-wrap break-all">
              {message}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
