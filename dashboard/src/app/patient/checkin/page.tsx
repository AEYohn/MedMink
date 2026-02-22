'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CareHubIntake } from '@/components/care-hub/CareHubIntake';
import { useTranslation } from '@/i18n';

export default function CheckInPage() {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-30 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button
          onClick={() => router.push('/patient')}
          className="p-2 -ms-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{t('checkin.title')}</h1>
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
        <div className="p-4 border-t border-border bg-card">
          <button
            onClick={() => router.push('/patient')}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            {t('checkin.done')}
          </button>
        </div>
      )}
    </div>
  );
}
