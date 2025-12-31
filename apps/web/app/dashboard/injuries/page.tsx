'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import InjuryAlertCard from '../../../components/InjuryAlertCard';
import { apiClient, getErrorMessage } from '../../../lib/api';

interface InjuryAlert {
  id: string;
  leagueId: string;
  week: number;
  season: number;
  injuredPlayerId: string;
  injuredPlayerName: string;
  position: string;
  team: string | null;
  previousStatus: string;
  newStatus: string;
  injuryDesignation: string | null;
  gameTime: string;
  gameId: string | null;
  opponent: string | null;
  detectedAt: string;
  minutesToKickoff: number;
  isUrgent: boolean;
  recommendedSubPlayerId: string | null;
  recommendedSubPlayerName: string | null;
  recommendedSubProjection: number | null;
  autoSubstituted: boolean;
  notificationSent: boolean;
  notificationSentAt: string | null;
  urgencyLevel: string;
  userAcknowledged: boolean;
  acknowledgedAt: string | null;
  userSubstituted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MonitoringStatus {
  isMonitoring: boolean;
  intervalMs: number | null;
  lastCheck: string | null;
}

export default function InjuryAlertsPage() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('leagueId');

  const [alerts, setAlerts] = useState<InjuryAlert[]>([]);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingMonitoring, setIsTogglingMonitoring] = useState(false);
  const [filterUnacknowledged, setFilterUnacknowledged] = useState(false);
  const [filterWeek, setFilterWeek] = useState<number | undefined>();
  const [filterSeason, setFilterSeason] = useState<number | undefined>();
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  useEffect(() => {
    if (leagueId) {
      loadAlerts();
      loadMonitoringStatus();
    }
  }, [leagueId, filterUnacknowledged, filterWeek, filterSeason]);

  const loadAlerts = async () => {
    if (!leagueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.injuries.getAlerts(leagueId, {
        week: filterWeek,
        season: filterSeason,
        unacknowledged: filterUnacknowledged,
      });

      setAlerts(response.alerts || []);
      setUnacknowledgedCount(response.unacknowledgedCount || 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonitoringStatus = async () => {
    try {
      const response = await apiClient.injuries.getMonitoringStatus();
      setMonitoringStatus(response.status);
    } catch (err) {
      console.error('Failed to load monitoring status:', err);
    }
  };

  const toggleMonitoring = async () => {
    setIsTogglingMonitoring(true);
    setError(null);

    try {
      if (monitoringStatus?.isMonitoring) {
        await apiClient.injuries.stopMonitoring();
      } else {
        await apiClient.injuries.startMonitoring();
      }
      await loadMonitoringStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsTogglingMonitoring(false);
    }
  };

  if (!leagueId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          Please select a league from your dashboard to view injury alerts.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Injury Alerts</h1>
            <p className="text-gray-600 mt-1">
              Real-time monitoring of your players during game windows
            </p>
          </div>

          {/* Monitoring Status Toggle */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Monitoring Status</p>
              <p className={`text-sm font-semibold ${monitoringStatus?.isMonitoring ? 'text-green-600' : 'text-gray-400'}`}>
                {monitoringStatus?.isMonitoring ? 'Active' : 'Inactive'}
              </p>
            </div>
            <button
              onClick={toggleMonitoring}
              disabled={isTogglingMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${
                monitoringStatus?.isMonitoring
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isTogglingMonitoring
                ? 'Updating...'
                : monitoringStatus?.isMonitoring
                ? 'Stop Monitoring'
                : 'Start Monitoring'}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Injury Monitoring Works</p>
              <p>
                The system monitors your starting players during NFL game windows (Thu 6-11PM, Sun 12PM-11PM, Mon 6-11PM ET).
                When a player's status changes to "Out" within 2 hours of kickoff, you'll receive an alert with a recommended
                substitution from your bench.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="unacknowledged"
            checked={filterUnacknowledged}
            onChange={(e) => setFilterUnacknowledged(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="unacknowledged" className="text-sm font-medium text-gray-700">
            Unacknowledged only
            {unacknowledgedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                {unacknowledgedCount}
              </span>
            )}
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="week" className="text-sm font-medium text-gray-700">
            Week:
          </label>
          <input
            type="number"
            id="week"
            value={filterWeek || ''}
            onChange={(e) => setFilterWeek(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="All"
            className="w-20 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max="18"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="season" className="text-sm font-medium text-gray-700">
            Season:
          </label>
          <input
            type="number"
            id="season"
            value={filterSeason || ''}
            onChange={(e) => setFilterSeason(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="All"
            className="w-24 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            min="2024"
            max="2030"
          />
        </div>

        <button
          onClick={loadAlerts}
          className="ml-auto px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No injury alerts</h3>
          <p className="mt-1 text-gray-500">
            {filterUnacknowledged
              ? 'All alerts have been acknowledged'
              : 'No injury alerts for the selected filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <InjuryAlertCard key={alert.id} alert={alert} onAcknowledge={loadAlerts} />
          ))}
        </div>
      )}
    </div>
  );
}
