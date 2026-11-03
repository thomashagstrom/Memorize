import Link from 'next/link';

import Leaderboard from '@/components/Leaderboard';

export default function LeaderboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <Link href="/" className="self-start text-blue-700 underline">
        ← Back
      </Link>
      <Leaderboard />
    </main>
  );
}
