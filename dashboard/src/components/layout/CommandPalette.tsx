'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useTheme } from 'next-themes';
import {
  Home,
  Stethoscope,
  Users,
  FolderOpen,
  FileText,
  Camera,
  Beaker,
  ClipboardList,
  Settings,
  MessageCircle,
  Plus,
  Moon,
  Sun,
  Search,
} from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { getCaseSessions } from '@/lib/storage';
import { searchPatients, getPatientDisplayName } from '@/lib/patient-storage';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { startNewConversation } = useChat();
  const { setTheme, theme } = useTheme();
  const [search, setSearch] = useState('');

  // Reset search when opened
  useEffect(() => {
    if (isOpen) setSearch('');
  }, [isOpen]);

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  // Dynamic results based on search
  const patients = search.length > 1 ? searchPatients(search).slice(0, 5) : [];
  const cases = search.length > 1
    ? getCaseSessions()
        .filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 5)
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search patients, cases, or type a command..."
              className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Dynamic patient results */}
            {patients.length > 0 && (
              <Command.Group heading="Patients">
                {patients.map((p) => (
                  <Command.Item
                    key={p.id}
                    onSelect={() => go(`/patients/${p.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{getPatientDisplayName(p)}</span>
                      {p.mrn && <span className="text-muted-foreground ml-2 text-xs font-mono">{p.mrn}</span>}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Dynamic case results */}
            {cases.length > 0 && (
              <Command.Group heading="Cases">
                {cases.map((c) => (
                  <Command.Item
                    key={c.id}
                    onSelect={() => go(`/cases/${c.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
                  >
                    <Stethoscope className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigate">
              {[
                { icon: Home, label: 'Dashboard', path: '/' },
                { icon: Users, label: 'Patients', path: '/patients' },
                { icon: FolderOpen, label: 'Cases', path: '/cases' },
                { icon: FileText, label: 'Documents', path: '/documents' },
                { icon: Stethoscope, label: 'New Analysis', path: '/case' },
                { icon: ClipboardList, label: 'Interview', path: '/interview' },
                { icon: Camera, label: 'Medical Imaging', path: '/imaging' },
                { icon: Beaker, label: 'Lab Reports', path: '/labs' },
                { icon: Settings, label: 'Settings', path: '/settings' },
              ].map((item) => (
                <Command.Item
                  key={item.path}
                  value={`navigate ${item.label}`}
                  onSelect={() => go(item.path)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Actions">
              <Command.Item
                value="new case analysis"
                onSelect={() => go('/case')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span>New Case Analysis</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Cmd+N</kbd>
              </Command.Item>
              <Command.Item
                value="new patient"
                onSelect={() => go('/patients')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
              >
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>Add New Patient</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Cmd+Shift+N</kbd>
              </Command.Item>
              <Command.Item
                value="new chat"
                onSelect={() => { startNewConversation(); onClose(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
                <span>New Chat</span>
              </Command.Item>
              <Command.Item
                value="toggle dark mode theme"
                onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-muted transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                <span>Toggle Dark Mode</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
