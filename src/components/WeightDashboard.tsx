import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Plus, TrendingUp, Calendar, Target, Scale } from "lucide-react";
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
  const [timePeriod, setTimePeriod] = useState<
    "week" | "month" | "year" | "all"
  >("all");

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
    if (weightEntries.length < 2) return 0;
    const latest = weightEntries[0].weight;
    const previous = weightEntries[1].weight;
    return latest - previous;
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
            return `Weight: ${context.parsed.y} lbs`;
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
            : "day") as "day" | "week" | "month",
          displayFormats: {
            day: "EEE d",
            week: "MMM d",
            month: "MMM yyyy",
            year: "yyyy",
          },
          tooltipFormat: "MMM d, yyyy",
        },
        grid: {
          display: false,
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
            return value + " lbs";
          },
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
              <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FitBuddy</h1>
                <p className="text-sm text-gray-600">
                  Weight Tracking Dashboard
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Stats Bar */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row md:divide-x divide-gray-200">
            {/* Current Weight */}
            <div className="flex-1 flex items-center pb-4 md:pb-0 md:pr-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Scale className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Current Weight
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {weightEntries.length > 0
                    ? `${weightEntries[0].weight} lbs`
                    : "No data"}
                </p>
              </div>
            </div>

            {/* Change */}
            <div className="flex-1 flex items-center py-4 md:py-0 md:px-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Change</p>
                <p
                  className={`text-2xl font-bold ${
                    getWeightChange() >= 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {weightEntries.length > 1
                    ? `${
                        getWeightChange() >= 0 ? "+" : ""
                      }${getWeightChange().toFixed(1)} lbs`
                    : "No change"}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex-1 flex items-center pt-4 md:pt-0 md:pl-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userProfile
                    ? `${getProgressToGoal().toFixed(0)}%`
                    : "No goal set"}
                </p>
              </div>
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
              <div className="bg-gray-200 rounded-full px-6 py-3 inline-flex items-center gap-4">
                <button
                  onClick={() => setTimePeriod("week")}
                  className={`font-medium transition-colors ${
                    timePeriod === "week"
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  Week
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => setTimePeriod("month")}
                  className={`font-medium transition-colors ${
                    timePeriod === "month"
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  Month
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => setTimePeriod("year")}
                  className={`font-medium transition-colors ${
                    timePeriod === "year"
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  Year
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => setTimePeriod("all")}
                  className={`font-medium transition-colors ${
                    timePeriod === "all"
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </>
        )}

        {/* Add Weight Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add Today's Weight</span>
          </button>
        </div>

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
