'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type { CarePlanItem, CarePlanStatus, CarePlanItemStatus } from '@/types/care-plan';
import { buildCarePlanItems } from '@/lib/care-plan-utils';
import { getCarePlanState, updateCarePlanItemStatus } from '@/lib/care-plan-storage';

export function useCarePlan(summary: ReleasedVisitSummary) {
  const items: CarePlanItem[] = useMemo(
    () => buildCarePlanItems(summary),
    [summary],
  );

  const [statuses, setStatuses] = useState<Record<string, CarePlanItemStatus>>({});

  useEffect(() => {
    const state = getCarePlanState(summary.id);
    setStatuses(state.items);
  }, [summary.id]);

  const updateStatus = useCallback(
    (itemId: string, status: CarePlanStatus) => {
      updateCarePlanItemStatus(summary.id, itemId, status);
      setStatuses(prev => ({
        ...prev,
        [itemId]: { status, updatedAt: new Date().toISOString() },
      }));
    },
    [summary.id],
  );

  const doneCount = items.filter(
    item => (statuses[item.id]?.status ?? 'todo') === 'done',
  ).length;

  return { items, statuses, updateStatus, doneCount, totalCount: items.length };
}
