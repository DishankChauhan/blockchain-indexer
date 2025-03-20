'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  if (session) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-lg border-gray-800">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">Blockchain Indexer</CardTitle>
          <CardDescription className="text-gray-300">
            Track and analyze blockchain transactions in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
            >
              Sign In
            </Button>
            <Button
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
            >
              Create Account
            </Button>
          </div>
          <div className="text-sm text-center text-gray-400">
            <p>Start indexing and analyzing blockchain data with ease</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 