'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, getErrorMessage } from '@/lib/api';

type Step = 'username' | 'select-league' | 'select-team';

interface SleeperLeague {
  id: string;
  name: string;
  season: string;
  totalRosters: number;
}

interface Team {
  rosterId: number;
  ownerId: string;
  ownerName: string;
  playerCount: number;
}

export default function ConnectLeaguePage() {
  const router = useRouter();

  // Step 1: Username
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [sleeperUserId, setSleeperUserId] = useState('');

  // Step 2: League selection
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null);

  // Step 3: Team selection
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearchUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiClient.leagues.search(username);

      if (data.leagues.length === 0) {
        setError('No leagues found for this username. Make sure you enter your Sleeper username correctly.');
        setLoading(false);
        return;
      }

      setSleeperUserId(data.sleeperUserId);
      setLeagues(data.leagues);
      setStep('select-league');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLeague = async (league: SleeperLeague) => {
    setSelectedLeague(league);
    setError('');
    setLoading(true);

    try {
      const data = await apiClient.leagues.lookup(league.id);
      setTeams(data.teams);
      setStep('select-team');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectLeague = async () => {
    if (!selectedLeague || !selectedTeam) return;

    setError('');
    setLoading(true);

    try {
      await apiClient.leagues.connect({
        platformLeagueId: selectedLeague.id,
        platformUserId: selectedTeam.ownerId,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 'select-team') {
      setStep('select-league');
      setSelectedTeam(null);
    } else if (step === 'select-league') {
      setStep('username');
      setLeagues([]);
      setSelectedLeague(null);
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
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center ${step === 'username' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'username' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Username</span>
              </div>
              <div className="flex-1 h-1 mx-4 bg-gray-200">
                <div className={`h-full bg-blue-600 transition-all ${step !== 'username' ? 'w-full' : 'w-0'}`}></div>
              </div>
              <div className={`flex items-center ${step === 'select-league' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'select-league' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium">League</span>
              </div>
              <div className="flex-1 h-1 mx-4 bg-gray-200">
                <div className={`h-full bg-blue-600 transition-all ${step === 'select-team' ? 'w-full' : 'w-0'}`}></div>
              </div>
              <div className={`flex items-center ${step === 'select-team' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'select-team' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Team</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Step 1: Enter Username */}
          {step === 'username' && (
            <>
              <h1 className="text-3xl font-bold mb-2">Connect Sleeper League</h1>
              <p className="text-gray-600 mb-8">
                Enter your Sleeper username to find your leagues.
              </p>

              <form onSubmit={handleSearchUsername} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Sleeper Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Sleeper username"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Not your email - the username you use to log into Sleeper
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !username}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Find My Leagues'}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Select League */}
          {step === 'select-league' && (
            <>
              <h1 className="text-2xl font-bold mb-2">Select Your League</h1>
              <p className="text-gray-600 mb-6">
                Found {leagues.length} league{leagues.length !== 1 ? 's' : ''} for <strong>{username}</strong>
              </p>

              <div className="space-y-3">
                {leagues.map((league) => (
                  <button
                    key={league.id}
                    onClick={() => handleSelectLeague(league)}
                    disabled={loading}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{league.name}</h3>
                        <p className="text-sm text-gray-500">Season: {league.season}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBack}
                className="mt-6 text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
            </>
          )}

          {/* Step 3: Select Team */}
          {step === 'select-team' && selectedLeague && (
            <>
              <h1 className="text-2xl font-bold mb-2">Select Your Team</h1>
              <p className="text-gray-600 mb-6">
                Which team is yours in <strong>{selectedLeague.name}</strong>?
              </p>

              <div className="space-y-3">
                {teams.map((team) => (
                  <button
                    key={team.rosterId}
                    onClick={() => setSelectedTeam(team)}
                    className={`w-full text-left p-4 border-2 rounded-lg transition ${
                      selectedTeam?.rosterId === team.rosterId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{team.ownerName}</h3>
                        <p className="text-sm text-gray-500">{team.playerCount} players</p>
                      </div>
                      {selectedTeam?.rosterId === team.rosterId && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleBack}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleConnectLeague}
                  disabled={loading || !selectedTeam}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Connecting...' : 'Connect League'}
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>What happens next:</strong> We'll sync your roster, league settings, and start generating AI-powered recommendations for trades and waivers.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
