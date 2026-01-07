'use client';

interface PlayerCardProps {
  player: {
    playerId?: string;
    playerName: string;
    position: string;
    team?: string;
    currentValue?: number;
    projectedValue?: number;
    projectedPoints?: number;
    performanceRatio?: number;
    zScore?: number;
    trend?: 'up' | 'down' | 'stable';
    injuryRisk?: number;
    isSellHigh?: boolean;
    isBuyLow?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
  showBadges?: boolean;
  showMetrics?: boolean;
}

const positionColors: Record<string, string> = {
  QB: 'bg-red-100 text-red-800',
  RB: 'bg-green-100 text-green-800',
  WR: 'bg-blue-100 text-blue-800',
  TE: 'bg-yellow-100 text-yellow-800',
  K: 'bg-purple-100 text-purple-800',
  DEF: 'bg-gray-100 text-gray-800',
};

export default function PlayerCard({
  player,
  size = 'md',
  showBadges = true,
  showMetrics = false
}: PlayerCardProps) {
  const sizeClasses = {
    sm: 'p-2 text-sm',
    md: 'p-3',
    lg: 'p-4',
  };

  const getTrendIcon = () => {
    if (!player.trend) return null;
    switch (player.trend) {
      case 'up':
        return <span className="text-green-600" title="Trending Up">↗</span>;
      case 'down':
        return <span className="text-red-600" title="Trending Down">↘</span>;
      default:
        return <span className="text-gray-600" title="Stable">→</span>;
    }
  };

  return (
    <div className={`border rounded-lg ${sizeClasses[size]} bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
              {player.playerName}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${positionColors[player.position] || 'bg-gray-100 text-gray-800'}`}>
              {player.position}
            </span>
            {player.trend && (
              <span className="text-sm">{getTrendIcon()}</span>
            )}
          </div>
          {player.team && (
            <p className="text-sm text-gray-600 mt-1">{player.team}</p>
          )}

          {(player.projectedValue !== undefined || player.projectedPoints !== undefined) && (
            <div className="mt-2 flex gap-4 text-sm">
              {player.currentValue !== undefined && (
                <div>
                  <span className="text-gray-500">Current:</span>{' '}
                  <span className="font-medium">{player.currentValue.toFixed(1)} pts</span>
                </div>
              )}
              {(player.projectedValue !== undefined || player.projectedPoints !== undefined) && (
                <div>
                  <span className="text-gray-500">Projected:</span>{' '}
                  <span className="font-medium">{(player.projectedValue || player.projectedPoints || 0).toFixed(1)} pts</span>
                </div>
              )}
            </div>
          )}

          {showMetrics && player.performanceRatio !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Performance:</span>
                <span className={`font-medium ${
                  player.performanceRatio > 1.15 ? 'text-green-600' :
                  player.performanceRatio < 0.85 ? 'text-red-600' :
                  'text-gray-700'
                }`}>
                  {player.performanceRatio.toFixed(2)}x
                </span>
              </div>
              {player.zScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Z-Score:</span>
                  <span className="font-medium">{player.zScore.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {showBadges && (player.isSellHigh || player.isBuyLow) && (
          <div className="flex flex-col gap-1">
            {player.isSellHigh && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Sell High
              </span>
            )}
            {player.isBuyLow && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                Buy Low
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
