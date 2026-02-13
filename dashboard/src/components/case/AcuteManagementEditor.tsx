'use client';

import { useState, useCallback } from 'react';
import {
  ShieldAlert,
  XCircle,
  Activity,
  Beaker,
  MessageCircle,
  Plus,
  Check,
  Pencil,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AcuteManagement } from '@/types/case';
import type { ClinicianOverrides, AcuteActionOverride, SectionCustomAction } from '@/lib/storage';
import { InlineAIAssist } from '@/components/case/InlineAIAssist';

interface AcuteManagementEditorProps {
  acuteManagement: AcuteManagement;
  overrides: ClinicianOverrides;
  onOverridesChange: (overrides: ClinicianOverrides) => void;
  caseSnippet?: string;
}

interface ActionItemProps {
  id: string;
  text: string;
  override: AcuteActionOverride | undefined;
  onToggle: () => void;
  onEditText: (text: string) => void;
}

function ActionItem({ id, text, override, onToggle, onEditText }: ActionItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(override?.editedText || text);
  const checked = override?.checked || false;
  const displayText = override?.editedText || text;

  const handleSave = () => {
    if (editValue.trim() !== text) {
      onEditText(editValue.trim());
    }
    setEditing(false);
  };

  return (
    <li className="flex items-start gap-2.5 group">
      <button
        onClick={onToggle}
        className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
          checked
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-muted-foreground/40 hover:border-primary'
        )}
      >
        {checked && <Check className="w-3 h-3" />}
      </button>

      {editing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <span
          className={cn(
            'text-sm flex-1',
            checked && 'line-through text-muted-foreground'
          )}
        >
          {displayText}
          {override?.addedAt && (
            <span className="text-[10px] text-muted-foreground ml-2">
              <Clock className="w-3 h-3 inline" /> {new Date(override.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
      )}

      <button
        onClick={() => { setEditValue(displayText); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
      </button>
    </li>
  );
}

// Sections that allow adding custom actions
const ADDABLE_SECTIONS = new Set(['immediate', 'monitoring', 'consult', 'counseling', 'metabolic']);

export function AcuteManagementEditor({
  acuteManagement,
  overrides,
  onOverridesChange,
  caseSnippet,
}: AcuteManagementEditorProps) {
  const [newActionText, setNewActionText] = useState('');
  const [addingToSection, setAddingToSection] = useState<string | null>(null);

  const getActionOverride = useCallback((id: string): AcuteActionOverride | undefined => {
    return overrides.acuteActions[id];
  }, [overrides]);

  const updateAction = useCallback((id: string, update: Partial<AcuteActionOverride>) => {
    const existing = overrides.acuteActions[id] || { checked: false };
    onOverridesChange({
      ...overrides,
      acuteActions: {
        ...overrides.acuteActions,
        [id]: {
          ...existing,
          ...update,
          addedAt: update.checked !== undefined ? new Date().toISOString() : existing.addedAt,
        },
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  const toggleAction = useCallback((id: string) => {
    const current = overrides.acuteActions[id]?.checked || false;
    updateAction(id, { checked: !current });
  }, [overrides, updateAction]);

  const editActionText = useCallback((id: string, text: string) => {
    updateAction(id, { editedText: text });
  }, [updateAction]);

  // Legacy global custom actions
  const addCustomAction = useCallback((text: string) => {
    if (!text.trim()) return;
    onOverridesChange({
      ...overrides,
      customActions: [
        ...overrides.customActions,
        { text: text.trim(), checked: false, addedAt: new Date().toISOString() },
      ],
      lastModified: new Date().toISOString(),
    });
    setNewActionText('');
    setAddingToSection(null);
  }, [overrides, onOverridesChange]);

  const toggleCustomAction = useCallback((index: number) => {
    const updated = [...overrides.customActions];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    onOverridesChange({
      ...overrides,
      customActions: updated,
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  const deleteCustomAction = useCallback((index: number) => {
    onOverridesChange({
      ...overrides,
      customActions: overrides.customActions.filter((_, i) => i !== index),
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  // Per-section custom actions
  const sectionCustomActions = overrides.sectionCustomActions || {};

  const addSectionAction = useCallback((sectionId: string, text: string) => {
    if (!text.trim()) return;
    const existing = sectionCustomActions[sectionId] || [];
    onOverridesChange({
      ...overrides,
      sectionCustomActions: {
        ...sectionCustomActions,
        [sectionId]: [
          ...existing,
          { id: `sca-${Date.now()}`, text: text.trim(), checked: false, addedAt: new Date().toISOString() },
        ],
      },
      lastModified: new Date().toISOString(),
    });
    setNewActionText('');
    setAddingToSection(null);
  }, [overrides, sectionCustomActions, onOverridesChange]);

  const deleteSectionAction = useCallback((sectionId: string, actionId: string) => {
    const existing = sectionCustomActions[sectionId] || [];
    onOverridesChange({
      ...overrides,
      sectionCustomActions: {
        ...sectionCustomActions,
        [sectionId]: existing.filter(a => a.id !== actionId),
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, sectionCustomActions, onOverridesChange]);

  const toggleSectionAction = useCallback((sectionId: string, actionId: string) => {
    const existing = sectionCustomActions[sectionId] || [];
    onOverridesChange({
      ...overrides,
      sectionCustomActions: {
        ...sectionCustomActions,
        [sectionId]: existing.map(a =>
          a.id === actionId ? { ...a, checked: !a.checked } : a
        ),
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, sectionCustomActions, onOverridesChange]);

  // Count completed items (AI + global custom + section custom)
  const allActionIds = [
    ...(acuteManagement.immediate_actions || []).map((_, i) => `immediate-${i}`),
    ...(acuteManagement.monitoring_plan || []).map((_, i) => `monitoring-${i}`),
    ...(acuteManagement.consults || []).map((_, i) => `consult-${i}`),
    ...(acuteManagement.metabolic_corrections || []).map((_, i) => `metabolic-${i}`),
    ...(acuteManagement.key_counseling || []).map((_, i) => `counseling-${i}`),
  ];
  const sectionCustomCount = Object.values(sectionCustomActions).reduce((sum, arr) => sum + arr.length, 0);
  const sectionCustomChecked = Object.values(sectionCustomActions).reduce(
    (sum, arr) => sum + arr.filter(a => a.checked).length, 0
  );
  const completedCount = allActionIds.filter(id => overrides.acuteActions[id]?.checked).length
    + overrides.customActions.filter(a => a.checked).length
    + sectionCustomChecked;
  const totalCount = allActionIds.length + overrides.customActions.length + sectionCustomCount;

  const renderSection = (
    title: string,
    items: string[] | undefined,
    idPrefix: string,
    icon: React.ReactNode,
    className?: string,
    allowAdd: boolean = false,
  ) => {
    const sectionActions = sectionCustomActions[idPrefix] || [];
    if ((!items || items.length === 0) && sectionActions.length === 0 && !allowAdd) return null;
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
              {icon} {title}
            </p>
            {caseSnippet && (
              <InlineAIAssist
                contextType="section"
                contextItem={title}
                caseSnippet={caseSnippet}
              />
            )}
          </div>
        </div>
        <ol className="space-y-1.5">
          {(items || []).map((item, i) => {
            const id = `${idPrefix}-${i}`;
            return (
              <ActionItem
                key={id}
                id={id}
                text={item}
                override={getActionOverride(id)}
                onToggle={() => toggleAction(id)}
                onEditText={(text) => editActionText(id, text)}
              />
            );
          })}
          {/* Per-section custom actions */}
          {sectionActions.map((action) => (
            <li key={action.id} className="flex items-start gap-2.5 group">
              <button
                onClick={() => toggleSectionAction(idPrefix, action.id)}
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                  action.checked
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-muted-foreground/40 hover:border-primary'
                )}
              >
                {action.checked && <Check className="w-3 h-3" />}
              </button>
              <span className={cn('text-sm flex-1', action.checked && 'line-through text-muted-foreground')}>
                {action.text}
                <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 h-4 text-blue-600 border-blue-300">
                  Clinician
                </Badge>
                <span className="text-[10px] text-muted-foreground ml-2">
                  <Clock className="w-3 h-3 inline" /> {new Date(action.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <button
                onClick={() => deleteSectionAction(idPrefix, action.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ol>
        {/* Inline add for this section */}
        {allowAdd && (
          addingToSection === idPrefix ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSectionAction(idPrefix, newActionText);
                  if (e.key === 'Escape') { setAddingToSection(null); setNewActionText(''); }
                }}
                autoFocus
                placeholder={`Add to ${title.toLowerCase()}...`}
                className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button size="sm" className="h-7 text-xs" onClick={() => addSectionAction(idPrefix, newActionText)}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingToSection(null); setNewActionText(''); }}>Cancel</Button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingToSection(idPrefix); setNewActionText(''); }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <Card className="border-orange-500/50 bg-gradient-to-br from-orange-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-orange-700">Acute Management Protocol</CardTitle>
          </div>
          {totalCount > 0 && (
            <Badge variant="outline" className={cn(
              'text-xs',
              completedCount === totalCount
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-orange-100 text-orange-700 border-orange-300'
            )}>
              {completedCount}/{totalCount} completed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Risk Stratification — read-only */}
        {acuteManagement.risk_stratification && (
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
              Risk Stratification
            </p>
            <p className="text-sm font-medium text-orange-800">
              {acuteManagement.risk_stratification}
            </p>
          </div>
        )}

        {/* Immediate Actions */}
        {renderSection(
          'Immediate Actions',
          acuteManagement.immediate_actions,
          'immediate',
          <ShieldAlert className="w-3.5 h-3.5" />,
          undefined,
          true,
        )}

        {/* Do Not Do — read-only warnings */}
        {acuteManagement.do_not_do && acuteManagement.do_not_do.length > 0 && (
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
              Do Not Do
            </p>
            <ul className="space-y-1.5">
              {acuteManagement.do_not_do.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Monitoring Plan */}
        {renderSection(
          'Monitoring Plan',
          acuteManagement.monitoring_plan,
          'monitoring',
          <Activity className="w-3.5 h-3.5" />,
          undefined,
          true,
        )}

        {/* Metabolic Corrections */}
        {renderSection(
          'Metabolic Corrections',
          acuteManagement.metabolic_corrections,
          'metabolic',
          <Beaker className="w-3.5 h-3.5" />,
          'p-3 bg-purple-500/10 rounded-lg border border-purple-500/20',
          true,
        )}

        {/* Disposition — read-only */}
        {acuteManagement.disposition && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disposition:</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30 font-medium">
              {acuteManagement.disposition}
            </Badge>
          </div>
        )}

        {/* Consults */}
        {renderSection(
          'Consults',
          acuteManagement.consults,
          'consult',
          <MessageCircle className="w-3.5 h-3.5" />,
          undefined,
          true,
        )}

        {/* Key Counseling */}
        {renderSection(
          'Key Counseling',
          acuteManagement.key_counseling,
          'counseling',
          <MessageCircle className="w-3.5 h-3.5" />,
          undefined,
          true,
        )}

        {/* Activity Restrictions — read-only */}
        {acuteManagement.activity_restrictions && acuteManagement.activity_restrictions.toLowerCase() !== 'none' && (
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Activity Restrictions</p>
            <p className="text-sm font-medium text-amber-800">{acuteManagement.activity_restrictions}</p>
          </div>
        )}

        {/* Legacy global custom actions */}
        {overrides.customActions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
              Clinician-Added Actions
            </p>
            <ol className="space-y-1.5">
              {overrides.customActions.map((action, i) => (
                <li key={`custom-${i}`} className="flex items-start gap-2.5 group">
                  <button
                    onClick={() => toggleCustomAction(i)}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      action.checked
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-muted-foreground/40 hover:border-primary'
                    )}
                  >
                    {action.checked && <Check className="w-3 h-3" />}
                  </button>
                  <span className={cn('text-sm flex-1', action.checked && 'line-through text-muted-foreground')}>
                    {action.text}
                    <span className="text-[10px] text-muted-foreground ml-2">
                      <Clock className="w-3 h-3 inline" /> {new Date(action.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <button
                    onClick={() => deleteCustomAction(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Add action button (global fallback) */}
        {addingToSection === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newActionText}
              onChange={(e) => setNewActionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomAction(newActionText);
                if (e.key === 'Escape') { setAddingToSection(null); setNewActionText(''); }
              }}
              autoFocus
              placeholder="Type new action item..."
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button size="sm" className="h-8" onClick={() => addCustomAction(newActionText)}>Add</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingToSection(null); setNewActionText(''); }}>Cancel</Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={() => setAddingToSection('custom')}
          >
            <Plus className="w-3.5 h-3.5" /> Add Action
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
