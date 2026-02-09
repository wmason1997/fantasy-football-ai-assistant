'use client';

import { useEffect, useState, useCallback } from 'react';
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

export default function TradesPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<any[]>([]);
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
        setSelectedLeague(response.leagues[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

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

      {/* Legacy card view for backward compatibility */}
      <div className="hidden">
        <div className="space-y-4">
          {filteredRecommendations.map((trade) => (
            <div
              key={trade.id}
              data-testid="trade-recommendation-card"
              onClick={() => setSelectedTrade(trade)}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Trade with {trade.targetTeamName}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">You Send:</p>
                      {trade.myPlayers.map((player) => (
                        <p key={player.id} className="text-sm text-gray-900">
                          {player.name} ({player.position})
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">You Receive:</p>
                      {trade.targetPlayers.map((player) => (
                        <p key={player.id} className="text-sm text-gray-900">
                          {player.name} ({player.position})
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">Fairness</p>
                    <p className="text-lg font-semibold text-green-600">
                      {(trade.fairnessScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Acceptance</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {(trade.acceptanceProbability * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">{trade.reasoning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Remove modal - using TradeRecommendationCard instead */}
      {false && selectedTrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedTrade(null)}
        >
          <div
            data-testid="trade-details-modal"
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Trade Details
              </h2>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Fairness Score
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${selectedTrade.fairnessScore * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-lg font-semibold text-green-600">
                    {(selectedTrade.fairnessScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Acceptance Probability
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${selectedTrade.acceptanceProbability * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">
                    {(selectedTrade.acceptanceProbability * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">You Send</h3>
                  {selectedTrade.myPlayers.map((player) => (
                    <div key={player.id} className="mb-2">
                      <p className="font-medium">{player.name}</p>
                      <p className="text-sm text-gray-600">
                        {player.position} - {player.team}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">You Receive</h3>
                  {selectedTrade.targetPlayers.map((player) => (
                    <div key={player.id} className="mb-2">
                      <p className="font-medium">{player.name}</p>
                      <p className="text-sm text-gray-600">
                        {player.position} - {player.team}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-700">{selectedTrade.reasoning}</p>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium">
                  Send Trade Offer
                </button>
                <button
                  onClick={() => setSelectedTrade(null)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
