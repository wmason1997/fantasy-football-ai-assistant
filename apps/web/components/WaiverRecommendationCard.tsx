'use client';

import { useState } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api';

interface WaiverRecommendationProps {
  recommendation: {
    id: string;
    playerName: string;
    position: string;
    team?: string;
    opportunityScore: number;
    projectedPoints: number;
    positionalNeed: number;
    wouldStartImmediately: boolean;
    recommendedBid?: number;
    minBid?: number;
    maxBid?: number;
    priorityRank?: number;
    shouldClaim?: boolean;
    suggestedDropPlayerName?: string;
    reasoning: string;
    confidence: number;
    urgency: string;
    status: string;
  };
  useFAAB?: boolean;
  onUpdate?: () => void;
}

const positionColors: Record<string, string> = {
  QB: 'bg-red-100 text-red-800',
  RB: 'bg-green-100 text-green-800',
  WR: 'bg-blue-100 text-blue-800',
  TE: 'bg-yellow-100 text-yellow-800',
  K: 'bg-purple-100 text-purple-800',
  DEF: 'bg-gray-100 text-gray-800',
};

const urgencyColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function WaiverRecommendationCard({ recommendation, useFAAB = true, onUpdate }: WaiverRecommendationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (action: 'viewed' | 'claimed' | 'missed' | 'dismissed') => {
    try {
      setLoading(true);
      setError('');
      await apiClient.waivers.trackClaim(recommendation.id, action);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className={`border-2 rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow ${urgencyColors[recommendation.urgency]}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold">{recommendation.playerName}</h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${positionColors[recommendation.position]}`}>
              {recommendation.position}
            </span>
            {recommendation.wouldStartImmediately && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                Starts Now
              </span>
            )}
          </div>
          {recommendation.team && (
            <p className="text-sm text-gray-600">{recommendation.team}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="px-3 py-1 bg-gray-900 text-white text-xs font-medium rounded-full uppercase">
            {recommendation.urgency} Priority
          </span>
          <span className="text-xs text-gray-500">
            {(recommendation.confidence * 100).toFixed(0)}% Confidence
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-white bg-opacity-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Opportunity</p>
          <p className={`text-xl font-bold ${getOpportunityColor(recommendation.opportunityScore)}`}>
            {(recommendation.opportunityScore * 100).toFixed(0)}
          </p>
        </div>
        <div className="text-center p-3 bg-white bg-opacity-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Projected Pts</p>
          <p className="text-xl font-bold text-blue-600">
            {recommendation.projectedPoints.toFixed(1)}
          </p>
        </div>
        <div className="text-center p-3 bg-white bg-opacity-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Need</p>
          <p className={`text-xl font-bold ${recommendation.positionalNeed > 0.7 ? 'text-red-600' : recommendation.positionalNeed > 0.5 ? 'text-yellow-600' : 'text-gray-600'}`}>
            {(recommendation.positionalNeed * 100).toFixed(0)}
          </p>
        </div>
      </div>

      {/* FAAB Bid or Priority */}
      {useFAAB && recommendation.recommendedBid !== undefined ? (
        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Recommended FAAB Bid:</span>
            <span className="text-2xl font-bold text-green-700">${recommendation.recommendedBid}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Min: ${recommendation.minBid}</span>
            <span>Max: ${recommendation.maxBid}</span>
          </div>
        </div>
      ) : (
        recommendation.priorityRank !== undefined && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-700">Priority Rank:</span>
              <span className="text-2xl font-bold text-blue-700">#{recommendation.priorityRank}</span>
            </div>
            {recommendation.shouldClaim && (
              <p className="text-xs text-green-600 mt-1 font-medium">✓ Recommended to claim</p>
            )}
          </div>
        )
      )}

      {/* Drop Suggestion */}
      {recommendation.suggestedDropPlayerName && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-100">
          <p className="text-sm">
            <span className="font-medium text-gray-700">Suggested drop: </span>
            <span className="text-gray-900">{recommendation.suggestedDropPlayerName}</span>
          </p>
        </div>
      )}

      {/* Reasoning */}
      <div className="mb-4 p-3 bg-white bg-opacity-70 rounded-lg">
        <p className="text-sm text-gray-700">{recommendation.reasoning}</p>
      </div>

      {/* Actions */}
      {recommendation.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('claimed')}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Claim Player
          </button>
          <button
            onClick={() => handleAction('dismissed')}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {recommendation.status === 'claimed' && (
        <div className="flex items-center gap-2 p-3 bg-green-100 rounded-lg">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-green-700">Claimed</span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
