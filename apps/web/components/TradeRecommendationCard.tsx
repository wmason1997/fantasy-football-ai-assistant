'use client';

import { useState } from 'react';
import PlayerCard from './PlayerCard';
import { apiClient, getErrorMessage } from '@/lib/api';

interface TradeRecommendationProps {
  recommendation: {
    id: string;
    myPlayers: any[];
    targetPlayers: any[];
    targetTeamName: string;
    fairnessScore: number;
    acceptanceProbability: number;
    myValueGain: number;
    tradeType: string;
    reasoning: string;
    confidence: number;
    status: string;
  };
  onUpdate?: () => void;
}

export default function TradeRecommendationCard({ recommendation, onUpdate }: TradeRecommendationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (action: 'viewed' | 'sent' | 'accepted' | 'rejected' | 'dismissed') => {
    try {
      setLoading(true);
      setError('');
      await apiClient.trades.trackResponse(recommendation.id, action);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getFairnessColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAcceptanceColor = (prob: number) => {
    if (prob >= 0.5) return 'text-green-600';
    if (prob >= 0.25) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {recommendation.tradeType} Trade Proposal
          </h3>
          <p className="text-sm text-gray-600">with {recommendation.targetTeamName}</p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            recommendation.confidence > 0.7
              ? 'bg-green-100 text-green-700'
              : recommendation.confidence > 0.5
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {(recommendation.confidence * 100).toFixed(0)}% Confidence
          </span>
        </div>
      </div>

      {/* Trade Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        {/* You Give */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-2">You Give:</h4>
          <div className="space-y-2">
            {recommendation.myPlayers.map((player: any, idx: number) => (
              <PlayerCard key={idx} player={player} size="sm" />
            ))}
          </div>
        </div>

        {/* You Receive */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-2">You Receive:</h4>
          <div className="space-y-2">
            {recommendation.targetPlayers.map((player: any, idx: number) => (
              <PlayerCard key={idx} player={player} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Fairness</p>
          <p className={`text-lg font-semibold ${getFairnessColor(recommendation.fairnessScore)}`}>
            {(recommendation.fairnessScore * 100).toFixed(0)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Acceptance Prob.</p>
          <p className={`text-lg font-semibold ${getAcceptanceColor(recommendation.acceptanceProbability)}`}>
            {(recommendation.acceptanceProbability * 100).toFixed(0)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Your Value Gain</p>
          <p className={`text-lg font-semibold ${recommendation.myValueGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {recommendation.myValueGain > 0 ? '+' : ''}{recommendation.myValueGain.toFixed(1)} pts
          </p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-gray-700">
          <span className="font-medium">Why this trade: </span>
          {recommendation.reasoning}
        </p>
      </div>

      {/* Actions */}
      {recommendation.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('sent')}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send Trade Offer
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

      {recommendation.status === 'sent' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('accepted')}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Mark as Accepted
          </button>
          <button
            onClick={() => handleAction('rejected')}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Mark as Rejected
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
