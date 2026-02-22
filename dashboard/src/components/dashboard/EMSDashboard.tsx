'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Siren,
  CheckCircle2,
  FileText,
  Activity,
  ChevronRight,
  Users,
  Search,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useEMSSession } from '@/hooks/useEMSSession';
import { EMSRunList } from '@/components/ems/EMSRunList';
import { SectionProgress } from '@/components/ems/SectionProgress';
import { RunTimer } from '@/components/ems/RunTimer';
import { getPatients, Patient, searchPatients, getPatientDisplayName } from '@/lib/patient-storage';

export function EMSDashboard() {
  const router = useRouter();
  const {
    allSessions,
    currentSession,
    isLoaded,
    initialize,
    loadSession,
    deleteSession,
  } = useEMSSession();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [footerDate, setFooterDate] = useState('');

  useEffect(() => {
    initialize();
    const today = new Date();
    setGreeting(today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening');
    setDateStr(today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    setFooterDate(today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }));
    setMounted(true);
  }, [initialize]);

  useEffect(() => {
    if (patientSearch.trim().length > 0) {
      setPatientResults(searchPatients(patientSearch).slice(0, 5));
    } else {
      setPatientResults([]);
    }
  }, [patientSearch]);

  const activeSessions = useMemo(
    () => allSessions.filter(s => s.status === 'active'),
    [allSessions],
  );

  const completedToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return allSessions.filter(
      s => s.status === 'complete' && new Date(s.startedAt) >= todayStart,
    ).length;
  }, [allSessions]);

  const handleSelectRun = (id: string) => {
    loadSession(id);
    router.push('/ems');
  };

  const chiefComplaint = currentSession
    ? (currentSession.extractedData?.patient_info as Record<string, string>)?.chief_complaint || 'In progress'
    : null;

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className={`mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <p className="text-sm text-muted-foreground font-mono tracking-wide">{dateStr}</p>
        <h1 className="font-display text-3xl lg:text-4xl text-foreground mt-1 italic">
          {greeting}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeSessions.length > 0
            ? `You have ${activeSessions.length} active run${activeSessions.length !== 1 ? 's' : ''}.`
            : 'No active runs. Start a new run report to get started.'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 animate-stagger ${mounted ? '' : 'opacity-0'}`}>
        {/* Active Runs */}
        <Link href="/ems" className="group">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all hover:shadow-sm">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Siren className="w-3.5 h-3.5 text-primary" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors ml-auto" />
              </div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {activeSessions.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Active Runs</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary/60 to-transparent heartbeat-sweep" />
            </div>
          </div>
        </Link>

        {/* Completed Today */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-chart-2/10 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-chart-2" />
            </div>
          </div>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {completedToday}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Completed Today</p>
        </div>

        {/* Total Reports */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {allSessions.length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Reports</p>
        </div>

        {/* System Status */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
            <p className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">All Systems Online</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">ePCR + Voice Dictation</p>
        </div>
      </div>

      {/* Main Content — Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column — 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/ems" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Siren className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">New Run Report</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Voice-guided ePCR</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>

              <Link href="/patients" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-chart-2" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">View Patients</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Patient directory</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Run Reports */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent Run Reports
              </h2>
              {allSessions.length > 0 && (
                <Link href="/ems" className="text-[11px] text-primary hover:underline underline-offset-2 font-medium">
                  View All
                </Link>
              )}
            </div>

            {allSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <Siren className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No run reports yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Start your first run report to see it here</p>
                <Link
                  href="/ems"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-primary font-medium hover:underline underline-offset-2"
                >
                  <Plus className="w-3 h-3" />
                  New Run Report
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-2">
                  <EMSRunList
                    sessions={allSessions.slice(0, 6)}
                    currentId={currentSession?.id}
                    onSelect={handleSelectRun}
                    onDelete={deleteSession}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — 2/5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Run Card */}
          {currentSession && currentSession.status === 'active' && (
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
                <Siren className="w-3 h-3" />
                Active Run
              </h2>
              <div className="rounded-xl border border-primary/20 bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{chiefComplaint}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-600 dark:text-amber-400">
                        {currentSession.phase}
                      </Badge>
                      <RunTimer startedAt={currentSession.startedAt} />
                    </div>
                  </div>
                </div>

                <SectionProgress
                  currentPhase={currentSession.phase}
                  sectionCompleteness={currentSession.sectionCompleteness}
                />

                <Link
                  href="/ems"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Resume Run
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Patient Lookup */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
              <Search className="w-3 h-3" />
              Patient Lookup
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Name or MRN..."
                    className="pl-9 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {patientResults.length > 0 ? (
                  <div className="p-1.5">
                    {patientResults.map((p) => (
                      <Link
                        key={p.id}
                        href={`/patients/${p.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center text-[11px] font-semibold text-primary">
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getPatientDisplayName(p)}</p>
                          {p.mrn && <p className="text-[11px] text-muted-foreground/60 font-mono">{p.mrn}</p>}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                      </Link>
                    ))}
                  </div>
                ) : patientSearch ? (
                  <div className="p-6 text-center">
                    <p className="text-xs text-muted-foreground/60">No patients found</p>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Users className="w-5 h-5 mx-auto text-muted-foreground/20 mb-1.5" />
                    <p className="text-[11px] text-muted-foreground/50">Search by name or MRN</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Version Footer */}
          <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">MedMink v1.0</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/30">
              {footerDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
