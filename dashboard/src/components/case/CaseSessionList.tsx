'use client';

import { useState } from 'react';
import { ChevronDown, FolderOpen, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CaseSession } from '@/lib/storage';

interface CaseSessionListProps {
  sessions: CaseSession[];
  currentSessionId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onNewCase: () => void;
}

export function CaseSessionList({
  sessions,
  currentSessionId,
  onLoad,
  onDelete,
  onNewCase,
}: CaseSessionListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (sessions.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm">Case Sessions</CardTitle>
                <Badge variant="secondary" className="text-xs">{sessions.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewCase();
                  }}
                  className="text-xs h-7"
                >
                  New Case
                </Button>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;
                const updatedAt = new Date(session.updatedAt);
                const timeStr = updatedAt.toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors group',
                      isCurrent ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50'
                    )}
                    onClick={() => onLoad(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm truncate',
                        isCurrent ? 'font-medium text-primary' : 'text-foreground'
                      )}>
                        {session.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {timeStr}
                        {session.events.length > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {session.events.length} event{session.events.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
