'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TradeRecommendationCard from '@/components/TradeRecommendationCard';
import { apiClient, getErrorMessage } from '@/lib/api';

export default function TradesPage() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('leagueId');

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [league, setLeague] = useState<any>(null);

  useEffect(() => {
    if (leagueId) {
      fetchLeague();
      fetchRecommendations();
    }
  }, [leagueId]);

  const fetchLeague = async () => {
    if (!leagueId) return;

    try {
      const { league } = await apiClient.leagues.getById(leagueId);
      setLeague(league);
    } catch (err) {
      console.error('Error fetching league:', err);
    }
  };

  const fetchRecommendations = async () => {
    if (!leagueId) return;

    try {
      setLoading(true);
      setError('');
      const data = await apiClient.trades.getRecommendations(leagueId);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!leagueId) return;

    try {
      setGenerating(true);
      setError('');
      await apiClient.trades.generateRecommendations(leagueId);
      await fetchRecommendations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  if (!leagueId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No League Selected</h1>
          <p className="text-gray-600">Please select a league from your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trade Analyzer</h1>
        {league && (
          <p className="text-gray-600">AI-powered trade recommendations for {league.leagueName}</p>
        )}
      </div>

      {/* Generate Button */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {generating ? 'Generating Recommendations...' : 'Generate New Recommendations'}
          </button>
        </div>

        {recommendations.length > 0 && (
          <div className="text-sm text-gray-600">
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

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
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No trade recommendations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate recommendations to see AI-powered trade suggestions
          </p>
        </div>
      )}

      {/* Recommendations List */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-6">
          {recommendations.map((rec) => (
            <TradeRecommendationCard
              key={rec.id}
              recommendation={rec}
              onUpdate={fetchRecommendations}
            />
          ))}
        </div>
      )}

      {/* Info Section */}
      {!loading && recommendations.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">How Trade Recommendations Work</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• AI identifies sell-high players on your roster (performing above projections)</li>
            <li>• Finds buy-low targets across your league (undervalued players)</li>
            <li>• Generates fair trade packages optimized for acceptance probability</li>
            <li>• Learns opponent tendencies from past trade history</li>
            <li>• Fairness score &gt;60% and acceptance probability &gt;25% recommended</li>
          </ul>
        </div>
      )}
    </div>
  );
}
