'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '@/lib/api-url';
import {
  getReferralNotifications,
  addReferralNotification,
  markNotificationRead,
  getUnreadReferralCount,
  getLastReferralCheck,
  setLastReferralCheck,
} from '@/lib/storage';
import type { ReferralNotification, ReferralSummary } from '@/types/referral';

const POLL_INTERVAL_MS = 30_000;

export function useReferralNotifications() {
  const [notifications, setNotifications] = useState<ReferralNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setNotifications(getReferralNotifications());
    setUnreadCount(getUnreadReferralCount());
  }, []);

  const checkForUpdates = useCallback(async () => {
    const apiUrl = getApiUrl();

    try {
      const response = await fetch(`${apiUrl}/api/case/referrals/sent`);
      if (!response.ok) return;

      const referrals: ReferralSummary[] = await response.json();
      const lastCheck = getLastReferralCheck();
      const newStatuses: Record<string, string> = {};

      for (const ref of referrals) {
        newStatuses[ref.referral_id] = ref.status;
        const previousStatus = lastCheck[ref.referral_id];

        if (previousStatus && previousStatus !== ref.status) {
          if (ref.status === 'viewed' && previousStatus === 'sent') {
            addReferralNotification({
              referral_id: ref.referral_id,
              type: 'viewed',
              message: `Your ${ref.specialty} referral was viewed`,
              read: false,
            });
          } else if (ref.status === 'responded') {
            addReferralNotification({
              referral_id: ref.referral_id,
              type: 'response_received',
              message: `Specialist responded to your ${ref.specialty} referral`,
              read: false,
            });
          }
        }
      }

      setLastReferralCheck(newStatuses);
      refresh();
    } catch {
      // Silently ignore polling errors
    }
  }, [refresh]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      markNotificationRead(notificationId);
      refresh();
    },
    [refresh]
  );

  // Initial load + polling
  useEffect(() => {
    refresh();
    checkForUpdates();
    intervalRef.current = setInterval(checkForUpdates, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, checkForUpdates]);

  return { notifications, unreadCount, markAsRead, refresh };
}
