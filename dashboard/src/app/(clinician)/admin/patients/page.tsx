'use client';

import { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  Download,
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  lastVisit: Date | null;
  nextAppointment: Date | null;
  status: 'active' | 'inactive';
  insuranceProvider?: string;
}

const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (555) 123-4567',
    dateOfBirth: '1985-03-15',
    lastVisit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    nextAppointment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'active',
    insuranceProvider: 'Blue Cross',
  },
  {
    id: '2',
    name: 'Maria Garcia',
    email: 'maria.garcia@email.com',
    phone: '+1 (555) 234-5678',
    dateOfBirth: '1992-07-22',
    lastVisit: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    nextAppointment: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'active',
    insuranceProvider: 'Aetna',
  },
  {
    id: '3',
    name: 'Robert Chen',
    email: 'robert.chen@email.com',
    phone: '+1 (555) 345-6789',
    dateOfBirth: '1978-11-08',
    lastVisit: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    nextAppointment: null,
    status: 'active',
    insuranceProvider: 'United Healthcare',
  },
  {
    id: '4',
    name: 'Emily Brown',
    email: 'emily.brown@email.com',
    phone: '+1 (555) 456-7890',
    dateOfBirth: '1990-05-30',
    lastVisit: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    nextAppointment: null,
    status: 'inactive',
  },
  {
    id: '5',
    name: 'Michael Johnson',
    email: 'michael.j@email.com',
    phone: '+1 (555) 567-8901',
    dateOfBirth: '1965-09-12',
    lastVisit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    nextAppointment: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'active',
    insuranceProvider: 'Medicare',
  },
];

export default function PatientsPage() {
  const [patients] = useState<Patient[]>(mockPatients);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Patients
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {patients.length} total patients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Add Patient
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-9 pr-4 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            </div>
            <button className="btn btn-ghost btn-sm">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  Patient
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  Last Visit
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  Next Appointment
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  Status
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {filteredPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {patient.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-surface-900 dark:text-white">
                          {patient.name}
                        </p>
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                          {getAge(patient.dateOfBirth)} years old
                          {patient.insuranceProvider && ` • ${patient.insuranceProvider}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className="text-sm text-surface-700 dark:text-surface-300 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {patient.email}
                      </p>
                      <p className="text-sm text-surface-700 dark:text-surface-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {patient.lastVisit ? (
                      <p className="text-sm text-surface-700 dark:text-surface-300">
                        {patient.lastVisit.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    ) : (
                      <span className="text-sm text-surface-400">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {patient.nextAppointment ? (
                      <p className="text-sm text-surface-700 dark:text-surface-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-500" />
                        {patient.nextAppointment.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    ) : (
                      <span className="text-sm text-surface-400">Not scheduled</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        patient.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                      }`}
                    >
                      {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-surface-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredPatients.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
            <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-1">
              No patients found
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredPatients.length > 0 && (
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Showing {filteredPatients.length} of {patients.length} patients
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors">
                Previous
              </button>
              <button className="px-3 py-1 text-sm bg-indigo-500 text-white rounded">
                1
              </button>
              <button className="px-3 py-1 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
