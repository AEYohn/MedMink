'use client';

import { useState, FormEvent } from 'react';
import { Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NewFindings } from '@/lib/storage';

const FINDING_CATEGORIES: { value: NewFindings['category']; label: string }[] = [
  { value: 'labs', label: 'Labs' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'physical_exam', label: 'Physical Exam' },
  { value: 'medications', label: 'Medications' },
  { value: 'clinical_change', label: 'Clinical Change' },
];

interface AddFindingsFormProps {
  onAddFindings: (findings: NewFindings) => void;
  onReassess: () => void;
  pendingFindings: NewFindings[];
  isReassessing: boolean;
}

export function AddFindingsForm({
  onAddFindings,
  onReassess,
  pendingFindings,
  isReassessing,
}: AddFindingsFormProps) {
  const [category, setCategory] = useState<NewFindings['category']>('labs');
  const [text, setText] = useState('');
  const [clinicalTime, setClinicalTime] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onAddFindings({
      category,
      text: text.trim(),
      clinicalTime: clinicalTime.trim() || undefined,
    });
    setText('');
    setClinicalTime('');
  };

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          Add New Findings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NewFindings['category'])}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {FINDING_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Clock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={clinicalTime}
                onChange={(e) => setClinicalTime(e.target.value)}
                placeholder="e.g., Day 2, 6h post-admission"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., Troponin peaked at 8.2 ng/mL, now trending down to 4.1"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </form>

        {/* Pending findings */}
        {pendingFindings.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending findings ({pendingFindings.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pendingFindings.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  <span className="font-semibold">{f.category.replace('_', ' ')}:</span>
                  {f.text.length > 40 ? f.text.slice(0, 40) + '...' : f.text}
                  {f.clinicalTime && (
                    <span className="text-muted-foreground">({f.clinicalTime})</span>
                  )}
                </Badge>
              ))}
            </div>
            <Button
              onClick={onReassess}
              disabled={isReassessing}
              size="sm"
              className="w-full"
            >
              {isReassessing ? 'Reassessing...' : `Reassess with ${pendingFindings.length} new finding(s)`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
