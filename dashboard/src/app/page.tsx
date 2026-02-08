'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Search,
  Camera,
  Beaker,
  ChevronRight,
  Shield,
  Users,
  Zap,
  Clock,
  Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ACTION_CARDS = [
  {
    href: '/case',
    icon: Stethoscope,
    title: 'Case Analysis',
    description: 'Paste a clinical vignette for evidence-based treatment recommendations with PubMed integration',
    gradient: 'from-primary/20 to-primary/5',
    iconBg: 'bg-primary/20 text-primary',
    tag: 'Core Feature',
  },
  {
    href: '/#consensus',
    icon: Search,
    title: 'Evidence Query',
    description: 'Ask a clinical question with multi-model consensus — Primary Clinician vs Skeptical Reviewer',
    gradient: 'from-accent/20 to-accent/5',
    iconBg: 'bg-accent/20 text-accent',
    tag: 'Multi-Model',
  },
  {
    href: '/imaging',
    icon: Camera,
    title: 'Medical Imaging',
    description: 'Upload X-ray, CT, or skin lesion photos for AI-powered image analysis with MedGemma multimodal',
    gradient: 'from-teal-500/20 to-teal-500/5',
    iconBg: 'bg-teal-500/20 text-teal-500',
    tag: 'Multimodal',
  },
  {
    href: '/labs',
    icon: Beaker,
    title: 'Lab Reports',
    description: 'Upload a lab report photo for automatic value extraction — abnormals highlighted and flagged',
    gradient: 'from-indigo-500/20 to-indigo-500/5',
    iconBg: 'bg-indigo-500/20 text-indigo-500',
    tag: 'Extraction',
  },
];

interface RecentSession {
  id: string;
  title: string;
  timestamp: string;
}

export default function HomePage() {
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  // Load recent case sessions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('research-synthesizer:case-sessions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentSessions(
            parsed.slice(0, 4).map((s: { id: string; title: string; createdAt: string }) => ({
              id: s.id,
              title: s.title || 'Untitled Case',
              timestamp: s.createdAt,
            }))
          );
        }
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <header className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-6 shadow-lg shadow-primary/20">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MedLit Agent
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-6">
            Evidence-Based Clinical Decision Support
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <Badge variant="outline" className="gap-1.5 bg-primary/5 border-primary/20 text-primary">
              <Shield className="w-3 h-3" /> Privacy-First
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-accent/5 border-accent/20 text-accent">
              <Users className="w-3 h-3" /> Multi-Model Consensus
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-amber-500/5 border-amber-500/20 text-amber-500">
              <Zap className="w-3 h-3" /> Local AI
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            16 specialties &bull; 7 validated cases &bull; MedGemma 1.5 + PubMed
          </p>
        </header>

        {/* Action Grid — 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 animate-stagger">
          {ACTION_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className={cn(
                'h-full cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 group',
                'bg-gradient-to-br',
                card.gradient,
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', card.iconBg)}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold">{card.title}</h2>
                        <Badge variant="secondary" className="text-[10px]">
                          {card.tag}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {card.description}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentSessions.map((s) => (
                <Link key={s.id} href="/case">
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Stethoscope className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.timestamp ? new Date(s.timestamp).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Model Status Footer */}
        <div className="flex items-center justify-center gap-6 p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
            <span>MedGemma 1.5 4B <span className="text-muted-foreground/60">(Local)</span></span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
            <span>MedGemma 27B <span className="text-muted-foreground/60">(Modal GPU)</span></span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3 h-3" />
            <span>System Online</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pt-8">
          <p className="text-xs text-muted-foreground">
            100% local inference &bull; No data leaves your device &bull; For educational purposes only
          </p>
        </footer>
      </div>
    </div>
  );
}
