'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import WaiverRecommendationCard from '@/components/WaiverRecommendationCard';
import { apiClient, getErrorMessage } from '@/lib/api';

function WaiversPageContent() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('leagueId');

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [positionalNeeds, setPositionalNeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [league, setLeague] = useState<any>(null);
  const [showNeeds, setShowNeeds] = useState(false);

  const fetchLeague = useCallback(async () => {
    if (!leagueId) return;

    try {
      const { league } = await apiClient.leagues.getById(leagueId);
      setLeague(league);
    } catch (err) {
      console.error('Error fetching league:', err);
    }
  }, [leagueId]);

  const fetchRecommendations = useCallback(async () => {
    if (!leagueId) return;

    try {
      setLoading(true);
      setError('');
      const data = await apiClient.waivers.getRecommendations(leagueId);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  const fetchPositionalNeeds = useCallback(async () => {
    if (!leagueId) return;

    try {
      const data = await apiClient.waivers.getPositionalNeeds(leagueId);
      setPositionalNeeds(data.positionalNeeds || []);
    } catch (err) {
      console.error('Error fetching positional needs:', err);
    }
  }, [leagueId]);

  useEffect(() => {
    if (leagueId) {
      fetchLeague();
      fetchRecommendations();
      fetchPositionalNeeds();
    }
  }, [leagueId, fetchLeague, fetchRecommendations, fetchPositionalNeeds]);

  const handleGenerate = async () => {
    if (!leagueId) return;

    try {
      setGenerating(true);
      setError('');
      await apiClient.waivers.generateRecommendations(leagueId);
      await fetchRecommendations();
      await fetchPositionalNeeds();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const useFAAB = league?.faabBudget && league.faabBudget > 0;

  if (!leagueId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No League Selected</h1>
          <p className="text-gray-600 mb-4">Please select a league from your dashboard</p>
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Waiver Wire Optimizer</h1>
        {league && (
          <p className="text-gray-600">
            AI-powered waiver recommendations for {league.leagueName}
            {useFAAB && ` • ${league.currentFaab || league.faabBudget}$ FAAB Remaining`}
          </p>
        )}
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {generating ? 'Generating Recommendations...' : 'Generate New Recommendations'}
          </button>

          <button
            onClick={() => setShowNeeds(!showNeeds)}
            className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showNeeds ? 'Hide' : 'Show'} Positional Needs
          </button>
        </div>

        {recommendations.length > 0 && (
          <div className="text-sm text-gray-600">
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Positional Needs Panel */}
      {showNeeds && positionalNeeds.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Your Roster Needs</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {positionalNeeds.map((need) => (
              <div key={need.position} className="text-center p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500 mb-1">{need.position}</div>
                <div className={`text-2xl font-bold ${
                  need.needScore > 0.7 ? 'text-red-600' :
                  need.needScore > 0.5 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {(need.needScore * 100).toFixed(0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {need.currentStarters}/{need.requiredStarters} starters
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && recommendations.length === 0 && (
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No waiver recommendations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate recommendations to see optimal waiver wire targets
          </p>
        </div>
      )}

      {/* Recommendations List */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <WaiverRecommendationCard
              key={rec.id}
              recommendation={rec}
              useFAAB={useFAAB}
              onUpdate={fetchRecommendations}
            />
          ))}
        </div>
      )}

      {/* Info Section */}
      {!loading && recommendations.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">How Waiver Recommendations Work</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• AI identifies high-value available players (opportunity score &gt; 0.3)</li>
            <li>• Analyzes your roster to determine positional needs</li>
            {useFAAB ? (
              <>
                <li>• Calculates optimal FAAB bids based on player value and roster needs</li>
                <li>• Never recommends more than 40% of your remaining budget</li>
                <li>• Adjusts for urgency when many leagues are adding the player</li>
              </>
            ) : (
              <>
                <li>• Ranks waiver claims by composite value score</li>
                <li>• Prioritizes players who would start immediately</li>
              </>
            )}
            <li>• Suggests which player to drop from your roster</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function WaiversPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <WaiversPageContent />
    </Suspense>
  );
}
