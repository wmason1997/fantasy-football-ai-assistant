'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient, getErrorMessage } from '@/lib/api';
import TradeRecommendationCard from '@/components/TradeRecommendationCard';

interface PlayerValue {
  playerId: string;
  playerName: string;
  position: string;
  team?: string;
  currentValue: number;
  projectedValue: number;
  performanceRatio: number;
  zScore: number;
  trend: 'up' | 'down' | 'stable';
  injuryRisk: number;
  isSellHigh: boolean;
  isBuyLow: boolean;
}

interface TradeRecommendation {
  id: string;
  myPlayers: PlayerValue[];
  targetPlayers: PlayerValue[];
  targetTeamName: string;
  fairnessScore: number;
  acceptanceProbability: number;
  myValueGain: number;
  targetValueGain: number;
  tradeType: string;
  reasoning: string;
  sellHighPlayers?: PlayerValue[];
  buyLowPlayers?: PlayerValue[];
  confidence: number;
  priority: number;
  status: string;
  week: number;
  season: number;
  createdAt?: string;
}

interface LeagueOption {
  id: string;
  leagueName: string;
}

export default function TradesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const leagueIdParam = searchParams.get('leagueId');
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [sellHighPlayers, setSellHighPlayers] = useState<PlayerValue[]>([]);
  const [buyLowPlayers, setBuyLowPlayers] = useState<PlayerValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentSeason, setCurrentSeason] = useState<number>(new Date().getFullYear());

  const loadLeagues = useCallback(async () => {
    try {
      const response = await apiClient.leagues.getAll();
      setLeagues(response.leagues);
      if (response.leagues.length > 0) {
        // Pre-select league from URL param if valid, otherwise first league
        const match = leagueIdParam && response.leagues.find((l) => l.id === leagueIdParam);
        setSelectedLeague(match ? match.id : response.leagues[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [leagueIdParam]);

  const loadTradeData = useCallback(async () => {
    if (!selectedLeague) return;

    try {
      setLoading(true);
      setError('');

      // Fetch existing recommendations
      const response = await apiClient.trades.getRecommendations(selectedLeague, {
        week: currentWeek,
        season: currentSeason,
        status: 'pending',
      });

      if (response.recommendations && response.recommendations.length > 0) {
        setRecommendations(response.recommendations);

        // Extract sell-high and buy-low players
        const sellHigh: PlayerValue[] = [];
        const buyLow: PlayerValue[] = [];

        response.recommendations.forEach((rec: TradeRecommendation) => {
          if (rec.sellHighPlayers) {
            rec.sellHighPlayers.forEach((player: PlayerValue) => {
              if (!sellHigh.find(p => p.playerId === player.playerId)) {
                sellHigh.push(player);
              }
            });
          }
          if (rec.buyLowPlayers) {
            rec.buyLowPlayers.forEach((player: PlayerValue) => {
              if (!buyLow.find(p => p.playerId === player.playerId)) {
                buyLow.push(player);
              }
            });
          }
        });

        setSellHighPlayers(sellHigh);
        setBuyLowPlayers(buyLow);
      } else {
        // No recommendations found - user needs to generate them
        setRecommendations([]);
        setSellHighPlayers([]);
        setBuyLowPlayers([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedLeague, currentWeek, currentSeason]);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  useEffect(() => {
    if (selectedLeague) {
      loadTradeData();
    }
  }, [selectedLeague, loadTradeData]);

  const generateRecommendations = async () => {
    try {
      setGenerating(true);
      setError('');

      await apiClient.trades.generateRecommendations(selectedLeague, {
        week: currentWeek,
        season: currentSeason,
        maxRecommendations: 10,
      });

      // Reload recommendations
      await loadTradeData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (positionFilter === 'all') return true;
    return rec.myPlayers.some(p => p.position === positionFilter) ||
           rec.targetPlayers.some(p => p.position === positionFilter);
  });

  if (loading && leagues.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No leagues connected
        </h3>
        <p className="text-gray-600 mb-6">
          Please connect a league to view trade recommendations.
        </p>
        <a
          href="/dashboard"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Connect League
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trade Analyzer</h1>
          <p className="mt-1 text-sm text-gray-600">
            AI-powered trade recommendations based on performance data
          </p>
        </div>

        <div className="flex gap-3">
          {leagues.length > 1 && (
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.leagueName || 'My League'}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={generateRecommendations}
            disabled={generating || !selectedLeague}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Recommendations'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Filter by Position:
          </label>
          <select
            name="position"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
          </select>
        </div>
      </div>

      {sellHighPlayers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Sell High Candidates</h2>
              <p className="text-sm text-gray-600">
                Players outperforming projections - trade while value is peak
              </p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              {sellHighPlayers.length} players
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sellHighPlayers.map((player) => (
              <div
                key={player.playerId}
                data-testid="player-card"
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition border-l-4 border-green-500"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{player.playerName}</h3>
                    <p className="text-sm text-gray-600">
                      {player.position} {player.team && `- ${player.team}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      Sell High
                    </span>
                    {player.trend === 'up' && (
                      <span className="text-xs text-green-600">↗ Trending Up</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium text-green-600">
                      {player.performanceRatio.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Z-Score:</span>
                    <span className="font-medium">{player.zScore.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projected Value:</span>
                    <span className="font-medium">{player.projectedValue.toFixed(1)} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {buyLowPlayers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Buy Low Targets</h2>
              <p className="text-sm text-gray-600">
                Undervalued players available across your league
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {buyLowPlayers.length} players
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buyLowPlayers.map((player) => (
              <div
                key={player.playerId}
                data-testid="player-card"
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{player.playerName}</h3>
                    <p className="text-sm text-gray-600">
                      {player.position} {player.team && `- ${player.team}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      Buy Low
                    </span>
                    {player.injuryRisk > 0 && player.injuryRisk < 0.3 && (
                      <span className="text-xs text-yellow-600">⚠ Low Risk</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium text-blue-600">
                      {player.performanceRatio.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-blue-600">
                      {((1 - player.performanceRatio) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projected Value:</span>
                    <span className="font-medium">{player.projectedValue.toFixed(1)} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Trade Recommendations Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Click &quot;Generate Recommendations&quot; to analyze your roster and find optimal trade opportunities based on player performance data.
            </p>
          </div>
        </div>
      )}

      {filteredRecommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Trade Recommendations
              </h2>
              <p className="text-sm text-gray-600">
                AI-generated packages optimized for value and acceptance probability
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              {filteredRecommendations.length} packages
            </span>
          </div>

          <div className="space-y-4">
            {filteredRecommendations.map((trade) => (
              <TradeRecommendationCard
                key={trade.id}
                recommendation={trade}
                onUpdate={loadTradeData}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
