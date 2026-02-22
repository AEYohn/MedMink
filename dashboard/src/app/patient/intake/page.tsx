'use client';

import { Heart } from 'lucide-react';
import { CareHubIntake } from '@/components/care-hub/CareHubIntake';

export default function StandaloneIntakePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Branding Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gradient-to-br from-primary to-primary/70 rounded-xl">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">MedMink</h1>
                <p className="text-[10px] text-muted-foreground leading-none">Patient Intake</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Intake Form */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <CareHubIntake />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-4">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs text-muted-foreground">
            This is not a substitute for professional medical advice. Always consult with a healthcare provider.
          </p>
        </div>
      </footer>
    </div>
  );
}
