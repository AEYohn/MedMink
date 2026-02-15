'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FileText,
  Search,
  Clock,
  Trash2,
  Filter,
  MoreVertical,
} from 'lucide-react';
import { getDocuments, deleteDocument } from '@/lib/document-storage';
import { ClinicalDocument, DocumentType, DOCUMENT_TYPE_LABELS } from '@/types/document';
import { getPatient, getPatientDisplayName } from '@/lib/patient-storage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statusColors: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-700 border-amber-200',
  final: 'bg-green-500/10 text-green-700 border-green-200',
  amended: 'bg-blue-500/10 text-blue-700 border-blue-200',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');

  useEffect(() => {
    setDocuments(getDocuments());
  }, []);

  const filtered = useMemo(() => {
    let result = documents;
    if (typeFilter !== 'all') {
      result = result.filter(d => d.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, search, typeFilter]);

  const handleDelete = (doc: ClinicalDocument) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    deleteDocument(doc.id);
    setDocuments(getDocuments());
    toast.success('Document deleted');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documents</h1>
            <p className="text-sm text-muted-foreground">{documents.length} total</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5 border border-input rounded-lg p-1">
          <Filter className="w-4 h-4 text-muted-foreground ml-2" />
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              typeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {DOCUMENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No documents found' : 'No documents yet'}
          description={search ? 'Try a different search' : 'Documents saved from case analyses will appear here'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const patient = doc.patientId ? getPatient(doc.patientId) : null;
            return (
              <Card key={doc.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <Link href={`/documents/${doc.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        <Badge variant="outline" className="shrink-0">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
                        {patient && (
                          <Badge variant="secondary" className="shrink-0">
                            {getPatientDisplayName(patient)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        <Badge className={`text-xs ${statusColors[doc.status]}`}>
                          {doc.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDelete(doc)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
