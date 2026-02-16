'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, getErrorMessage } from '@/lib/api';
import type { League } from '@fantasy-football/shared';

export default function DashboardPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const response = await apiClient.leagues.getAll();
      setLeagues(response.leagues);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">My Leagues</h1>
        <Link
          href="/dashboard/connect"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Connect League
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading leagues...</p>
        </div>
      ) : leagues.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No leagues connected
          </h3>
          <p className="text-gray-600 mb-6">
            Connect your fantasy football league to get AI-powered trade
            recommendations, waiver wire insights, and injury alerts.
          </p>
          <Link
            href="/dashboard/connect"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Connect Your First League
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {league.leagueName || 'My League'}
                  </h3>
                  <p className="text-sm text-gray-600 capitalize">
                    {league.platform} • {(league.scoringSettings as any)?.season || new Date().getFullYear()}
                  </p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Active
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Teams:</span>
                  <span className="font-medium text-gray-900">
                    {(league.rosterSettings as any)?.totalTeams || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scoring:</span>
                  <span className="font-medium text-gray-900 uppercase">
                    {(league.scoringSettings as any)?.scoringType || 'standard'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4">
                <Link
                  href={`/dashboard/trades?leagueId=${league.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Trades
                </Link>
                <Link
                  href={`/dashboard/waivers?leagueId=${league.id}`}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Waivers
                </Link>
                <Link
                  href={`/dashboard/injuries?leagueId=${league.id}`}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Injuries
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
