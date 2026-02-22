'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CareHubIntake } from '@/components/care-hub/CareHubIntake';

export default function CheckInPage() {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);

  return (
    <div className="fixed inset-0 z-30 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <button
          onClick={() => router.push('/patient')}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Check-in</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <CareHubIntake
          onComplete={() => setCompleted(true)}
          onBack={() => router.push('/patient')}
        />
      </div>

      {/* Done button when completed */}
      {completed && (
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={() => router.push('/patient')}
            className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
