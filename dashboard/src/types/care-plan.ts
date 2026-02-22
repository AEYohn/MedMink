export type CarePlanItemType = 'procedure' | 'diagnostic' | 'supportive_care' | 'referral' | 'follow_up';
export type CarePlanStatus = 'todo' | 'scheduled' | 'done';

export interface CarePlanItem {
  id: string;
  title: string;
  description: string;
  itemType: CarePlanItemType;
  timeframe?: string;
  provider?: string;
  source: 'order' | 'followUp';
  sourceIndex: number;
}

export interface CarePlanItemStatus {
  status: CarePlanStatus;
  updatedAt: string;
}

export interface CarePlanState {
  summaryId: string;
  items: Record<string, CarePlanItemStatus>;
}
