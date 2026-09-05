import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Archive, RefreshCw } from 'lucide-react';

export const SectionsList = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data: sections, isLoading } = useQuery({
    queryKey: ['sections', includeArchived],
    queryFn: async () => {
      const res = await api.get('/sections', { params: { includeArchived } });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/sections', { name: newSectionName, description: newSectionDesc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setShowCreate(false);
      setNewSectionName('');
      setNewSectionDesc('');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string, isArchived: boolean }) => {
      const endpoint = isArchived ? 'restore' : 'archive';
      return api.post(`/sections/${id}/${endpoint}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });

  if (user?.role !== 'EDITOR') {
    return <div className="text-red-500">Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sections Management</h2>
        <div className="space-x-4 flex items-center">
          <label className="flex items-center text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="mr-2 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show Archived
          </label>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" /> New Section
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white shadow rounded-lg p-4 space-y-4 border border-indigo-100">
          <h3 className="text-lg font-medium">Create New Section</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Section Name"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newSectionDesc}
              onChange={(e) => setNewSectionDesc(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newSectionName || createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Section'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {isLoading && <li className="px-6 py-4 text-gray-500">Loading...</li>}
          {!isLoading && sections?.length === 0 && (
            <li className="px-6 py-4 text-gray-500">No sections found.</li>
          )}
          {sections?.map((section: any) => (
            <li key={section.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-gray-900 flex items-center">
                  {section.name}
                  {section.isArchived && (
                    <span className="ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Archived
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-500">{section.description || 'No description'}</p>
                <div className="mt-2 text-xs text-gray-400 flex space-x-4">
                  <span>Articles: {section._count?.articles || 0}</span>
                  <span>Writers: {section._count?.writers || 0}</span>
                  <span>Owner: {section.owner?.email}</span>
                </div>
              </div>
              <div>
                <button
                  onClick={() => archiveMutation.mutate({ id: section.id, isArchived: section.isArchived })}
                  className="inline-flex items-center p-2 border border-gray-300 rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                  title={section.isArchived ? "Restore" : "Archive"}
                >
                  {section.isArchived ? <RefreshCw className="h-4 w-4 text-green-600" /> : <Archive className="h-4 w-4 text-red-600" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
