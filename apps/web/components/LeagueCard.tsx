'use client';

import { useState, useEffect } from 'react';
import type { League } from '@fantasy-football/shared';
import Link from 'next/link';
import { apiClient } from '../lib/api';

interface LeagueCardProps {
  league: League;
}

export default function LeagueCard({ league }: LeagueCardProps) {
  const [unacknowledgedCount, setUnacknowledgedCount] = useState<number>(0);

  useEffect(() => {
    const fetchUnacknowledgedAlerts = async () => {
      try {
        const response = await apiClient.injuries.getAlerts(league.id, {
          unacknowledged: true,
        });
        setUnacknowledgedCount(response.unacknowledgedCount || 0);
      } catch (error) {
        console.error('Failed to fetch unacknowledged alerts:', error);
      }
    };

    fetchUnacknowledgedAlerts();
    // Poll every 30 seconds for updates during game windows
    const interval = setInterval(fetchUnacknowledgedAlerts, 30000);
    return () => clearInterval(interval);
  }, [league.id]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold mb-1">{league.leagueName || 'Unnamed League'}</h3>
          <p className="text-sm text-gray-600">{league.teamName || 'Your Team'}</p>
        </div>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          {league.platform}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {league.faabBudget !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">FAAB Remaining:</span>
            <span className="font-medium">
              ${league.currentFaab} / ${league.faabBudget}
            </span>
          </div>
        )}

        {league.waiverPriority !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Waiver Priority:</span>
            <span className="font-medium">#{league.waiverPriority}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Roster Size:</span>
          <span className="font-medium">{league.rosters?.length || 0} players</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last Synced:</span>
          <span className="font-medium">{formatDate(league.lastSynced)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Link
          href={`/dashboard/trades?leagueId=${league.id}`}
          className="block text-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
        >
          Trade Analyzer
        </Link>
        <Link
          href={`/dashboard/waivers?leagueId=${league.id}`}
          className="block text-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium"
        >
          Waiver Wire
        </Link>
        <Link
          href={`/dashboard/injuries?leagueId=${league.id}`}
          className="block text-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium relative"
        >
          Injury Alerts
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
              {unacknowledgedCount}
            </span>
          )}
        </Link>
      </div>

      <Link
        href={`/dashboard/leagues/${league.id}`}
        className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition text-sm"
      >
        View Details
      </Link>
    </div>
  );
}
