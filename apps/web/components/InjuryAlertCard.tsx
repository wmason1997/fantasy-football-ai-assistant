'use client';

import { useState } from 'react';
import { apiClient, getErrorMessage } from '../lib/api';

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

interface InjuryAlertCardProps {
  alert: InjuryAlert;
  onAcknowledge?: () => void;
}

export default function InjuryAlertCard({ alert, onAcknowledge }: InjuryAlertCardProps) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAlert, setLocalAlert] = useState(alert);

  const urgencyColors = {
    low: 'border-gray-300 bg-gray-50',
    medium: 'border-yellow-400 bg-yellow-50',
    high: 'border-orange-400 bg-orange-50',
    critical: 'border-red-500 bg-red-50',
  };

  const urgencyBadgeColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  const handleAcknowledge = async (substituted: boolean) => {
    setIsAcknowledging(true);
    setError(null);

    try {
      await apiClient.injuries.acknowledgeAlert(localAlert.id, substituted);
      setLocalAlert({
        ...localAlert,
        userAcknowledged: true,
        userSubstituted: substituted,
        acknowledgedAt: new Date().toISOString(),
      });
      if (onAcknowledge) onAcknowledge();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsAcknowledging(false);
    }
  };

  const formatGameTime = (gameTimeStr: string) => {
    const gameTime = new Date(gameTimeStr);
    return gameTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const formatMinutesToKickoff = (minutes: number) => {
    if (minutes < 0) return 'Game started';
    if (minutes < 60) return `${minutes} min to kickoff`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m to kickoff`;
  };

  return (
    <div
      className={`border-2 rounded-lg p-6 ${urgencyColors[localAlert.urgencyLevel as keyof typeof urgencyColors] || urgencyColors.medium}`}
    >
      {/* Header with urgency badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">
              {localAlert.injuredPlayerName}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${urgencyBadgeColors[localAlert.urgencyLevel as keyof typeof urgencyBadgeColors] || urgencyBadgeColors.medium}`}
            >
              {localAlert.urgencyLevel.toUpperCase()}
            </span>
            {localAlert.isUrgent && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-600 text-white">
                URGENT
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{localAlert.position}</span>
            {localAlert.team && (
              <>
                <span>•</span>
                <span>{localAlert.team}</span>
              </>
            )}
            {localAlert.opponent && (
              <>
                <span>•</span>
                <span>vs {localAlert.opponent}</span>
              </>
            )}
          </div>
        </div>

        {localAlert.userAcknowledged && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Acknowledged
          </div>
        )}
      </div>

      {/* Injury Information */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-white rounded-lg">
        <div>
          <p className="text-xs text-gray-500 mb-1">Status Change</p>
          <p className="text-sm font-medium">
            <span className="text-gray-600">{localAlert.previousStatus}</span>
            <span className="mx-2">→</span>
            <span className="text-red-600 font-bold">{localAlert.newStatus}</span>
          </p>
        </div>
        {localAlert.injuryDesignation && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Injury</p>
            <p className="text-sm font-medium text-gray-900">{localAlert.injuryDesignation}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-1">Game Time</p>
          <p className="text-sm font-medium text-gray-900">{formatGameTime(localAlert.gameTime)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Time to Kickoff</p>
          <p className="text-sm font-medium text-gray-900">
            {formatMinutesToKickoff(localAlert.minutesToKickoff)}
          </p>
        </div>
      </div>

      {/* Substitution Recommendation */}
      {localAlert.recommendedSubPlayerName && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Recommended Substitution
              </p>
              <p className="text-lg font-bold text-blue-700">
                {localAlert.recommendedSubPlayerName}
              </p>
              {localAlert.recommendedSubProjection !== null && (
                <p className="text-sm text-blue-600 mt-1">
                  Projected: {localAlert.recommendedSubProjection.toFixed(1)} pts
                </p>
              )}
            </div>
            {localAlert.autoSubstituted && (
              <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white">
                AUTO-SUB
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timing Information */}
      <div className="mb-4 text-xs text-gray-500">
        <p>
          Detected: {new Date(localAlert.detectedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        {localAlert.notificationSent && localAlert.notificationSentAt && (
          <p>
            Notification sent: {new Date(localAlert.notificationSentAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Actions */}
      {!localAlert.userAcknowledged && (
        <div className="flex flex-col gap-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleAcknowledge(true)}
              disabled={isAcknowledging}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isAcknowledging ? 'Acknowledging...' : 'Made Substitution'}
            </button>
            <button
              onClick={() => handleAcknowledge(false)}
              disabled={isAcknowledging}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isAcknowledging ? 'Acknowledging...' : 'Acknowledge (No Sub)'}
            </button>
          </div>
        </div>
      )}

      {/* Acknowledged Status */}
      {localAlert.userAcknowledged && localAlert.acknowledgedAt && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
          <p className="text-green-800">
            <span className="font-medium">
              {localAlert.userSubstituted ? 'Substitution made' : 'Acknowledged without substitution'}
            </span>
            <span className="text-green-600 ml-2">
              {new Date(localAlert.acknowledgedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
