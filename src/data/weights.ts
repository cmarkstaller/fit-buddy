import { WeightEntry } from "../lib/localStorage";

// Dummy weight data for a demo user. Dates are most-recent first.
const DEMO_USER_ID = "demo-user";

// Helper function to generate date strings
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const formatDateTime = (date: Date): string => {
  return date.toISOString();
};

// Generate realistic weight loss data starting from Oct 27, 2024 (1 year ago) to Oct 27, 2025
const generateWeightEntries = (): WeightEntry[] => {
  const entries: WeightEntry[] = [];
  const startDate = new Date(2024, 9, 27); // Oct 27, 2024
  const endDate = new Date(2025, 9, 27); // Oct 27, 2025

  // Starting weight 195 lbs, target 180 lbs
  let currentWeight = 195.0;

  // Some milestone notes
  const notesTimeline: Record<string, string> = {
    "2024-10-27": "Starting my weight loss journey!",
    "2024-11-24": "Thanksgiving - slight setback, but back on track",
    "2024-12-24": "Christmas temptation, staying consistent",
    "2024-12-31": "New Year's resolution in action",
    "2025-02-14": "Valentine's Day - treating myself responsibly",
    "2025-04-01": "Spring is here, feeling great!",
    "2025-07-04": "Summer progress, halfway to goal!",
    "2025-10-01": "Almost at the finish line!",
    "2025-10-27": "One year of dedication, hit my target!",
  };

  // Last month date threshold (September 27, 2025)
  const lastMonthThreshold = new Date(2025, 8, 27); // Sept 27, 2025

  // Generate entries roughly every 3-4 days (some variation for realism)
  let date = new Date(startDate);
  let entryId = 1;

  while (date <= endDate && currentWeight >= 180.0) {
    // Random weight variation (-0.5 to 0.5 lbs) to simulate daily fluctuation
    const randomVariation = (Math.random() - 0.5) * 0.6;

    // Progressive weight loss: faster at beginning, slower towards end
    const progress = 1 - (currentWeight - 180) / (195 - 180);
    const weeklyLoss = progress < 0.3 ? 0.4 : progress < 0.7 ? 0.3 : 0.2;

    // Determine if this is the last month (daily entries)
    const isLastMonth = date >= lastMonthThreshold;

    // Determine days to add based on which period we're in
    if (isLastMonth) {
      // Last month: daily entries
      currentWeight = currentWeight - weeklyLoss / 7 + randomVariation;
    } else {
      // Earlier periods: 3-4 days between entries
      // Occasionally add a small gain to simulate plateaus
      const addGain = Math.random() < 0.08 && currentWeight < 190;
      const daysBetweenEntries = Math.floor(Math.random() * 2) + 3;
      currentWeight = addGain
        ? currentWeight + 0.3
        : currentWeight -
          (weeklyLoss / 7) * daysBetweenEntries +
          randomVariation;
    }

    // Ensure we don't go below target
    currentWeight = Math.max(currentWeight, 180.0);

    const dateStr = formatDate(date);
    const dateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      8,
      0
    );

    entries.push({
      id: `w-${String(entryId).padStart(3, "0")}`,
      user_id: DEMO_USER_ID,
      weight: Math.round(currentWeight * 10) / 10,
      date: dateStr,
      notes: notesTimeline[dateStr] || undefined,
      created_at: formatDateTime(dateTime),
      updated_at: formatDateTime(dateTime),
    });

    // Add days based on which period we're in
    if (isLastMonth) {
      // Last month: increment by 1 day
      date.setDate(date.getDate() + 1);
    } else {
      // Earlier periods: add 3-4 days randomly
      const daysToAdd = Math.floor(Math.random() * 2) + 3;
      date.setDate(date.getDate() + daysToAdd);
    }
    entryId++;
  }

  // Reverse to have most recent first
  return entries.reverse();
};

export const mockWeightEntries: WeightEntry[] = generateWeightEntries();

export const DEMO_USER_ID_FOR_WEIGHTS = DEMO_USER_ID;
