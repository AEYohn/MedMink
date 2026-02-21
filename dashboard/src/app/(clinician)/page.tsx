'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Search,
  Camera,
  Beaker,
  ChevronRight,
  Users,
  FolderOpen,
  AlertTriangle,
  ClipboardList,
  Plus,
  ArrowUpRight,
  FileText,
  TrendingUp,
  Clock,
  Shield,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getCaseSessions, CaseSession } from '@/lib/storage';
import { getPatients, Patient, searchPatients, getPatientDisplayName } from '@/lib/patient-storage';

export default function DashboardPage() {
  const [recentCases, setRecentCases] = useState<CaseSession[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [footerDate, setFooterDate] = useState('');

  useEffect(() => {
    const today = new Date();
    setGreeting(today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening');
    setDateStr(today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    setFooterDate(today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }));
    setRecentCases(getCaseSessions().slice(0, 6));
    setPatients(getPatients());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (patientSearch.trim().length > 0) {
      setPatientResults(searchPatients(patientSearch).slice(0, 5));
    } else {
      setPatientResults([]);
    }
  }, [patientSearch]);

  const activeCases = recentCases.filter(c => c.currentResult);
  const activePatients = patients.filter(p => p.status === 'active');
  const pendingAlerts = recentCases.reduce((count, c) => {
    const result = c.currentResult as Record<string, unknown> | null;
    const safety = result?.safety_alerts as unknown[];
    return count + (Array.isArray(safety) ? safety.length : 0);
  }, 0);

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className={`mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <p className="text-sm text-muted-foreground font-mono tracking-wide">{dateStr}</p>
        <h1 className="font-display text-3xl lg:text-4xl text-foreground mt-1 italic">
          {greeting}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeCases.length > 0
            ? `You have ${activeCases.length} active case${activeCases.length !== 1 ? 's' : ''} and ${pendingAlerts} pending alert${pendingAlerts !== 1 ? 's' : ''}.`
            : 'No active cases. Start a new analysis to get started.'}
        </p>
      </div>

      {/* Stats — Asymmetric Bento Grid */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 animate-stagger ${mounted ? '' : 'opacity-0'}`}>
        {/* Active Cases — Large */}
        <Link href="/cases" className="group">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all hover:shadow-sm">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors ml-auto" />
              </div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                {activeCases.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Active Cases</p>
            </div>
            {/* Decorative heartbeat line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary/60 to-transparent heartbeat-sweep" />
            </div>
          </div>
        </Link>

        {/* Patients */}
        <Link href="/patients" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all hover:shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-chart-2/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-chart-2" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors ml-auto" />
            </div>
            <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
              {activePatients.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Patients</p>
          </div>
        </Link>

        {/* Safety Alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              pendingAlerts > 0 ? 'bg-accent/10' : 'bg-muted'
            }`}>
              <Shield className={`w-3.5 h-3.5 ${pendingAlerts > 0 ? 'text-accent' : 'text-muted-foreground'}`} />
            </div>
            {pendingAlerts > 0 && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-accent font-medium">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-subtle" />
                REVIEW
              </span>
            )}
          </div>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {pendingAlerts}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Safety Alerts</p>
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
          <p className="text-xs text-muted-foreground mt-1">MedGemma 27B + PubMed</p>
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
              <Link href="/case?new=true" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">New Case Analysis</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Evidence-based workup</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>

              <Link href="/interview" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4 text-chart-2" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Patient Interview</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">AI-guided intake</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>

              <Link href="/imaging" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-chart-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Medical Imaging</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Upload & classify</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>

              <Link href="/labs" className="group">
                <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                      <Beaker className="w-4 h-4 text-chart-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Lab Reports</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Extract & analyze</p>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Cases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent Cases
              </h2>
              <Link href="/cases" className="text-[11px] text-primary hover:underline underline-offset-2 font-medium">
                View All
              </Link>
            </div>

            {recentCases.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <Stethoscope className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No cases yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Start your first analysis to see it here</p>
                <Link
                  href="/case?new=true"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-primary font-medium hover:underline underline-offset-2"
                >
                  <Plus className="w-3 h-3" />
                  New Case Analysis
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentCases.map((c, i) => (
                  <Link key={c.id} href={`/cases/${c.id}`}>
                    <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {c.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-muted-foreground/60">
                            {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {c.events.length > 0 && (
                            <span className="text-[11px] text-muted-foreground/40">
                              {c.events.length} event{c.events.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {c.currentResult ? (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-mono border-primary/20 text-primary">
                          Analyzed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-mono text-muted-foreground/60">
                          Draft
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — 2/5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Search */}
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

          {/* Quick Links */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Quick Links</h2>
            <div className="space-y-1.5">
              <Link href="/patients/new" className="group">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/20 transition-all">
                  <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">Add New Patient</p>
                    <p className="text-[11px] text-muted-foreground/50">Register a new patient</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/20" />
                </div>
              </Link>

              <Link href="/documents" className="group">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/20 transition-all">
                  <div className="w-8 h-8 rounded-md bg-chart-4/10 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-chart-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">Documents</p>
                    <p className="text-[11px] text-muted-foreground/50">Clinical documents & notes</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/20" />
                </div>
              </Link>
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
