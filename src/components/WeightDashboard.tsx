import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  TrendingUp,
  Calendar,
  Scale,
  Menu,
  X,
  Settings,
  LogOut,
} from "lucide-react";
import { format, parseISO, subDays, subMonths, subYears } from "date-fns";
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
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

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

export function WeightDashboard() {
  const { user, userProfile, weightEntries, signOut, addWeight } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [timePeriod, setTimePeriod] = useState<
    "week" | "month" | "year" | "all"
  >("month");

  // Close menu when clicking outside
  useEffect(() => {
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

  const addWeightEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newWeight) return;

    setSubmitting(true);
    try {
      const { error } = await addWeight(
        parseFloat(newWeight),
        newNotes || undefined
      );

      if (error) {
        console.error("Error adding weight entry:", error);
        return;
      }

      setNewWeight("");
      setNewNotes("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding weight entry:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getWeightChange = () => {
    if (weightEntries.length === 0) return 0;
    // Determine cutoff based on selected time period
    const now = new Date();
    let cutoffDate: Date;
    switch (timePeriod) {
      case "week":
        cutoffDate = subDays(now, 7);
        break;
      case "month":
        cutoffDate = subMonths(now, 1);
        break;
      case "year":
        cutoffDate = subYears(now, 1);
        break;
      default:
        cutoffDate = new Date(0);
    }

    // Filter entries within the period
    const periodEntries = weightEntries.filter(
      (entry) => new Date(entry.date) >= cutoffDate
    );
    if (periodEntries.length < 2) return 0;

    // Sort by date ascending to pick earliest and latest in the range
    const sortedByDate = [...periodEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const earliest = sortedByDate[0].weight;
    const latest = sortedByDate[sortedByDate.length - 1].weight;
    return latest - earliest;
  };

  const getProgressToGoal = () => {
    if (!userProfile || weightEntries.length === 0) return 0;
    const currentWeight = weightEntries[0].weight;
    const totalChange = userProfile.starting_weight - userProfile.target_weight;
    const currentChange = userProfile.starting_weight - currentWeight;
    return Math.min((currentChange / totalChange) * 100, 100);
  };

  const getChartData = () => {
    if (weightEntries.length === 0) return null;

    // Filter entries based on selected time period
    const now = new Date();
    let cutoffDate: Date;

    switch (timePeriod) {
      case "week":
        cutoffDate = subDays(now, 7);
        break;
      case "month":
        cutoffDate = subMonths(now, 1);
        break;
      case "year":
        cutoffDate = subYears(now, 1);
        break;
      default:
        cutoffDate = new Date(0);
    }

    // Filter and sort entries by date (oldest first for chart)
    const filteredEntries = weightEntries.filter(
      (entry) => new Date(entry.date) >= cutoffDate
    );

    const sortedEntries = [...filteredEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Convert to time scale format with x (timestamp) and y (weight) values
    const data = sortedEntries.map((entry) => ({
      x: entry.date,
      y: entry.weight,
    }));

    // Target weight line (flat across x-axis)
    const targetWeight = userProfile?.target_weight;
    const targetDataset =
      typeof targetWeight === "number" && Number.isFinite(targetWeight)
        ? {
            label: "Target Weight",
            data: sortedEntries.map((entry) => ({
              x: entry.date,
              y: targetWeight,
            })),
            borderColor: "#D1D5DB", // light gray
            borderWidth: 2,
            borderDash: [6, 6] as [number, number],
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
          }
        : null;

    return {
      datasets: [
        {
          label: "Weight (lbs)",
          data: data,
          borderColor: "rgb(34, 85, 108)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
        },
        ...(targetDataset ? [targetDataset] : []),
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
        callbacks: {
          title: function (context: any) {
            return format(parseISO(context[0].raw.x), "MMM d, yyyy");
          },
          label: function (context: any) {
            const y = Number(context.parsed.y);
            return `Weight: ${
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
          font: {
            size: 12,
          },
          source: "auto" as const,
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 12,
          },
          callback: function (value: any) {
            const v = Number(value);
            return `${Number.isFinite(v) ? v.toFixed(1) : value} lbs`;
          },
          maxTicksLimit: 6,
        },
      },
    },
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-[rgb(60,96,96)] rounded-full flex items-center justify-center">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FitBuddy</h1>
                <p className="text-sm text-gray-600">
                  {userProfile?.username
                    ? userProfile.username
                    : "Weight Tracking Dashboard"}
                </p>
              </div>
            </div>
            {/* Hamburger Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                {showMenu ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              {/* Dropdown Menu */}
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
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Stats Bar */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-8">
          <div className="grid grid-cols-3 divide-x divide-gray-200 text-center">
            {/* Current Weight */}
            <div className="px-2">
              <p className="text-[11px] font-medium text-gray-600 tracking-wide uppercase">
                Current
              </p>
              <p className="text-lg font-bold text-gray-900">
                {weightEntries.length > 0
                  ? `${weightEntries[0].weight} lbs`
                  : "—"}
              </p>
            </div>

            {/* Change */}
            <div className="px-2">
              <p className="text-[11px] font-medium text-gray-600 tracking-wide uppercase">
                Change
              </p>
              <p
                className={`text-lg font-bold ${
                  getWeightChange() >= 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {weightEntries.length > 1
                  ? `${
                      getWeightChange() >= 0 ? "+" : ""
                    }${getWeightChange().toFixed(1)} lbs`
                  : "—"}
              </p>
            </div>

            {/* Progress */}
            <div className="px-2">
              <p className="text-[11px] font-medium text-gray-600 tracking-wide uppercase">
                Progress
              </p>
              <p className="text-lg font-bold text-gray-900">
                {userProfile ? `${getProgressToGoal().toFixed(0)}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Weight Progress Chart */}
        {weightEntries.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Weight Progress
                </h3>
                <div className="text-sm text-gray-600">
                  {weightEntries.length} entries
                </div>
              </div>
              <div className="h-80">
                <Line data={getChartData()!} options={chartOptions} />
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
          </>
        )}

        {/* Floating Add Weight Button */}
        <button
          aria-label="Add Today's Weight"
          onClick={() => setShowAddForm(true)}
          className="fixed z-20 bottom-20 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-[rgb(159,137,103)] text-white shadow-xl flex items-center justify-center hover:bg-[rgb(140,120,90)] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[rgb(159,137,103)]"
        >
          <Plus className="h-7 w-7" />
        </button>

        {/* Add Weight Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Weight Entry
            </h3>
            <form onSubmit={addWeightEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="150.0"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="How are you feeling today?"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Weight History */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Weight History
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {weightEntries.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Scale className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>
                  No weight entries yet. Add your first entry to get started!
                </p>
              </div>
            ) : (
              weightEntries.map((entry, index) => {
                const change =
                  index < weightEntries.length - 1
                    ? entry.weight - weightEntries[index + 1].weight
                    : 0;

                return (
                  <div key={entry.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {format(parseISO(entry.date), "MMMM d, yyyy")}
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {entry.weight} lbs
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-gray-600 mt-1">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {change !== 0 && (
                          <p
                            className={`text-sm font-medium ${
                              change >= 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {change >= 0 ? "+" : ""}
                            {change.toFixed(1)} lbs
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
