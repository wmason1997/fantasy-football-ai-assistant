/**
 * NFL utility functions for calculating weeks, seasons, etc.
 */

/**
 * Get the current NFL week based on the date
 * NFL regular season typically starts first Thursday in September
 *
 * @param date Optional date (defaults to now)
 * @returns Current NFL week (1-18) or 0 if offseason
 */
export function getCurrentNFLWeek(date: Date = new Date()): number {
  const year = date.getFullYear();

  // Approximate NFL season start (first Thursday in September)
  // In 2025, Week 1 starts September 4
  const seasonStart = new Date(year, 8, 1); // September 1
  const dayOfWeek = seasonStart.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  seasonStart.setDate(seasonStart.getDate() + daysUntilThursday);

  // If we're before the season, return 0
  if (date < seasonStart) {
    return 0;
  }

  // Calculate weeks since season start
  const millisecondsDiff = date.getTime() - seasonStart.getTime();
  const daysDiff = Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
  const week = Math.floor(daysDiff / 7) + 1;

  // Regular season is 18 weeks
  return Math.min(week, 18);
}

/**
 * Get the current NFL season year
 * @param date Optional date (defaults to now)
 * @returns Season year
 */
export function getCurrentNFLSeason(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();

  // If it's January-July, we're still in the previous season
  if (month < 7) {
    return year - 1;
  }

  return year;
}

/**
 * Check if we're in the NFL season
 * @param date Optional date (defaults to now)
 * @returns True if in season
 */
export function isNFLSeason(date: Date = new Date()): boolean {
  return getCurrentNFLWeek(date) > 0;
}

// Add getCurrentWeek method to Date prototype for convenience
declare global {
  interface Date {
    getWeek(): number;
  }
}

Date.prototype.getWeek = function(): number {
  return getCurrentNFLWeek(this);
};
