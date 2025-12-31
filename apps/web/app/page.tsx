import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-6">
          Fantasy Football AI Assistant
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Data-driven trade recommendations, waiver wire optimization, and real-time injury alerts
          to give you a competitive edge in your fantasy league.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
