'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, getErrorMessage } from '@/lib/api';

export default function ConnectLeaguePage() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.leagues.connect({
        platformLeagueId: leagueId,
        platformUserId: userId || undefined,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-2">Connect Sleeper League</h1>
          <p className="text-gray-600 mb-8">
            Enter your Sleeper league ID to connect and sync your league data.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="leagueId" className="block text-sm font-medium text-gray-700 mb-1">
                Sleeper League ID *
              </label>
              <input
                id="leagueId"
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                You can find your league ID in the Sleeper app URL
              </p>
            </div>

            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                Your Sleeper User ID (optional)
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 987654321"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use the first team in the league
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">How to find your IDs:</h3>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Open your league in the Sleeper app or website</li>
                <li>Check the URL - it contains your league ID</li>
                <li>Your user ID can be found in your profile settings</li>
              </ol>
            </div>

            <button
              type="submit"
              disabled={loading || !leagueId}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect League'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
