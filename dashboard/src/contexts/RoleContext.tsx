'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { UserRole, RoleConfig, ROLE_CONFIGS } from '@/types/role';

interface RoleContextValue {
  role: UserRole | null;
  roleConfig: RoleConfig | null;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
  isLoaded: boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  roleConfig: null,
  setRole: () => {},
  clearRole: () => {},
  isLoaded: false,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleValue, isLoaded] = usePersistentState<UserRole | null>('user-role', null);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleValue(newRole);
  }, [setRoleValue]);

  const clearRole = useCallback(() => {
    setRoleValue(null);
  }, [setRoleValue]);

  const roleConfig = role ? ROLE_CONFIGS[role] : null;

  return (
    <RoleContext.Provider value={{ role, roleConfig, setRole, clearRole, isLoaded }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
