'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntakeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/patient/checkin');
  }, [router]);

  return null;
}
