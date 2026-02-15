'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Search,
  Camera,
  Beaker,
  ChevronRight,
  Clock,
  Activity,
  Users,
  FolderOpen,
  AlertTriangle,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getCaseSessions, CaseSession } from '@/lib/storage';
import { getPatients, Patient, searchPatients, getPatientDisplayName } from '@/lib/patient-storage';

export default function DashboardPage() {
  const [recentCases, setRecentCases] = useState<CaseSession[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);

  useEffect(() => {
    setRecentCases(getCaseSessions().slice(0, 5));
    setPatients(getPatients());
  }, []);

  useEffect(() => {
    if (patientSearch.trim().length > 0) {
      setPatientResults(searchPatients(patientSearch).slice(0, 5));
    } else {
      setPatientResults([]);
    }
  }, [patientSearch]);

  const activeCases = recentCases.filter(c => c.currentResult);
  const pendingAlerts = recentCases.reduce((count, c) => {
    const result = c.currentResult as Record<string, unknown> | null;
    const safety = result?.safety_alerts as unknown[];
    return count + (Array.isArray(safety) ? safety.length : 0);
  }, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/cases">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{activeCases.length}</p>
                  <p className="text-xs text-muted-foreground">Active Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/patients">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{patients.filter(p => p.status === 'active').length}</p>
                  <p className="text-xs text-muted-foreground">Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingAlerts}</p>
                <p className="text-xs text-muted-foreground">Safety Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
                  Online
                </p>
                <p className="text-xs text-muted-foreground">System Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Actions + Recent Cases (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: '/case', icon: Stethoscope, label: 'New Case', color: 'text-primary bg-primary/10' },
                { href: '/interview', icon: ClipboardList, label: 'Interview', color: 'text-accent bg-accent/10' },
                { href: '/imaging', icon: Camera, label: 'Upload Image', color: 'text-teal-500 bg-teal-500/10' },
                { href: '/labs', icon: Beaker, label: 'View Labs', color: 'text-indigo-500 bg-indigo-500/10' },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Cases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Cases
              </h2>
              <Link href="/cases" className="text-xs text-primary hover:underline">
                View All
              </Link>
            </div>

            {recentCases.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Stethoscope className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No cases yet</p>
                  <Link href="/case" className="text-xs text-primary hover:underline mt-1 inline-block">
                    Start your first analysis
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentCases.map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`}>
                    <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Stethoscope className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString()}
                            {c.events.length > 0 && ` \u00b7 ${c.events.length} events`}
                          </p>
                        </div>
                        {c.currentResult && (
                          <Badge variant="outline" className="shrink-0">Analyzed</Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Patient Search (1/3) */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Patient Search</h2>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by name or MRN..."
                    className="pl-10"
                  />
                </div>
                {patientResults.length > 0 && (
                  <div className="space-y-1">
                    {patientResults.map((p) => (
                      <Link
                        key={p.id}
                        href={`/patients/${p.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getPatientDisplayName(p)}</p>
                          {p.mrn && <p className="text-xs text-muted-foreground font-mono">{p.mrn}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {patientSearch && patientResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No patients found</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Add */}
          <Card>
            <CardContent className="p-4">
              <Link
                href="/patients"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Add New Patient</span>
              </Link>
            </CardContent>
          </Card>

          {/* Version Footer */}
          <div className="flex items-center justify-center gap-2 p-3 bg-card rounded-xl border text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
            MedLit Agent v1.0
          </div>
        </div>
      </div>
    </div>
  );
}
