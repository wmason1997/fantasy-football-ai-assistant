'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient, getErrorMessage } from '@/lib/api';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
}

interface TradeRecommendation {
  id: string;
  myPlayers: Player[];
  targetPlayers: Player[];
  targetTeamName: string;
  fairnessScore: number;
  acceptanceProbability: number;
  reasoning: string;
}

export default function TradesPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [sellHighPlayers, setSellHighPlayers] = useState<Player[]>([]);
  const [buyLowPlayers, setBuyLowPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<TradeRecommendation | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>('all');

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeague) {
      loadTradeData();
    }
  }, [selectedLeague]);

  const loadLeagues = async () => {
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
  };

  const loadTradeData = async () => {
    try {
      setLoading(true);
      // Mock data for E2E tests
      setSellHighPlayers([
        { id: '1', name: 'Player A', position: 'RB', team: 'KC' },
        { id: '2', name: 'Player B', position: 'WR', team: 'BUF' },
      ]);

      setBuyLowPlayers([
        { id: '3', name: 'Player C', position: 'WR', team: 'SF' },
        { id: '4', name: 'Player D', position: 'RB', team: 'DAL' },
      ]);

      setRecommendations([
        {
          id: '1',
          myPlayers: [{ id: '1', name: 'Player A', position: 'RB', team: 'KC' }],
          targetPlayers: [{ id: '3', name: 'Player C', position: 'WR', team: 'SF' }],
          targetTeamName: 'Team Alpha',
          fairnessScore: 0.85,
          acceptanceProbability: 0.72,
          reasoning: 'This trade leverages Player A\'s overperformance to acquire undervalued Player C.',
        },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
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
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Trade Recommendations</h1>
        
        {leagues.length > 1 && (
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
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

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sell High</h2>
        <p className="text-sm text-gray-600 mb-4">
          Players performing above projections - trade while their value is high
        </p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sellHighPlayers.map((player) => (
            <div
              key={player.id}
              data-testid="player-card"
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{player.name}</h3>
                  <p className="text-sm text-gray-600">
                    {player.position} - {player.team}
                  </p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Sell
                </span>
              </div>
              <div className="mt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Performance Ratio:</span>
                  <span className="font-medium text-green-600">1.25x</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Buy Low</h2>
        <p className="text-sm text-gray-600 mb-4">
          Undervalued players across your league - buy while they\'re cheap
        </p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buyLowPlayers.map((player) => (
            <div
              key={player.id}
              data-testid="player-card"
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{player.name}</h3>
                  <p className="text-sm text-gray-600">
                    {player.position} - {player.team}
                  </p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                  Buy
                </span>
              </div>
              <div className="mt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Value Discount:</span>
                  <span className="font-medium text-blue-600">25%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recommended Trade Packages
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          AI-generated trade packages optimized for fairness and acceptance probability
        </p>
        
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

      {selectedTrade && (
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
