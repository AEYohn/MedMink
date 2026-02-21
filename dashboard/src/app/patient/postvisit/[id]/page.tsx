'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PostVisitRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/patient');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-surface-500">Redirecting to Care Hub...</p>
      </div>
    </div>
  );
}
