'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  Search,
  Clock,
  Stethoscope,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { getCaseSessions, CaseSession } from '@/lib/storage';
import { getPatient, getPatientDisplayName } from '@/lib/patient-storage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function CasesPage() {
  const [cases, setCases] = useState<CaseSession[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');

  useEffect(() => {
    setCases(getCaseSessions());
  }, []);

  const filtered = useMemo(() => {
    let result = cases;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.originalCaseText.toLowerCase().includes(q)
      );
    }

    if (dateFilter !== 'all') {
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(c => new Date(c.createdAt) >= cutoff);
    }

    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [cases, search, dateFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cases</h1>
            <p className="text-sm text-muted-foreground">{cases.length} total</p>
          </div>
        </div>
        <Link
          href="/case"
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
        >
          <Stethoscope className="w-4 h-4" />
          New Analysis
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5 border border-input rounded-lg p-1">
          <Filter className="w-4 h-4 text-muted-foreground ml-2" />
          {(['all', '7d', '30d', '90d'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                dateFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Case List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? 'No cases found' : 'No cases yet'}
          description={search ? 'Try a different search term' : 'Start a new case analysis to see it here'}
          action={!search ? { label: 'New Analysis', onClick: () => window.location.href = '/case' } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const patient = c.patientId ? getPatient(c.patientId) : null;
            return (
              <Link key={c.id} href={`/cases/${c.id}`}>
                <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                        {patient && (
                          <Badge variant="outline" className="shrink-0">
                            {getPatientDisplayName(patient)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                        {c.events.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {c.events.length} event{c.events.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {c.followUpMessages.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {c.followUpMessages.length} follow-up{c.followUpMessages.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.currentResult ? (
                        <Badge variant="default">Analyzed</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
