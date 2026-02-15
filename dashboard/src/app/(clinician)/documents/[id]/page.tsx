'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FileText,
  ArrowLeft,
  Printer,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { getDocument, updateDocument } from '@/lib/document-storage';
import { ClinicalDocument, DOCUMENT_TYPE_LABELS } from '@/types/document';
import { getPatient, getPatientDisplayName } from '@/lib/patient-storage';
import { Badge } from '@/components/ui/badge';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<ClinicalDocument | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const id = params.id as string;
    const found = getDocument(id);
    if (!found) {
      router.push('/documents');
      return;
    }
    setDoc(found);
    setEditContent(found.content);
  }, [params.id, router]);

  const handleSave = () => {
    if (!doc) return;
    const updated = updateDocument(doc.id, { content: editContent });
    if (updated) {
      setDoc(updated);
      setEditing(false);
      toast.success('Document updated');
    }
  };

  const handleFinalize = () => {
    if (!doc) return;
    const updated = updateDocument(doc.id, { status: 'final' });
    if (updated) {
      setDoc(updated);
      toast.success('Document finalized');
    }
  };

  if (!doc) return null;

  const patient = doc.patientId ? getPatient(doc.patientId) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/documents" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{doc.title}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
            <Badge variant={doc.status === 'final' ? 'default' : 'secondary'}>{doc.status}</Badge>
            {patient && <Badge variant="secondary">{getPatientDisplayName(patient)}</Badge>}
            <span className="text-xs text-muted-foreground">
              Created {new Date(doc.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {doc.status === 'draft' && (
            <button
              onClick={handleFinalize}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Finalize
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors inline-flex items-center gap-2"
          >
            {editing ? <><X className="w-4 h-4" /> Cancel</> : <><Pencil className="w-4 h-4" /> Edit</>}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors inline-flex items-center gap-2 no-print"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-8">
        {editing ? (
          <div className="space-y-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 text-sm bg-background border border-input rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditContent(doc.content);
                }}
                className="px-4 py-2 text-sm text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
            {doc.content}
          </pre>
        )}
      </div>
    </div>
  );
}
