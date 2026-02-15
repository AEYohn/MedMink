'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCaseSessions } from '@/lib/storage';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params.id as string;
    const sessions = getCaseSessions();
    const found = sessions.find(s => s.id === id);

    if (found) {
      // Redirect to the case analysis page with this session loaded
      router.replace(`/case?session=${id}`);
    } else {
      router.replace('/cases');
    }
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-pulse text-sm text-muted-foreground">Loading case...</div>
    </div>
  );
}
