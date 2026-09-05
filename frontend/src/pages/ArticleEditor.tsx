import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Save, Send, CheckCircle, Clock, Globe } from 'lucide-react';

export const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sectionId, setSectionId] = useState('');

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await api.get(`/articles/${id}`);
      return res.data;
    },
    enabled: !isNew,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const res = await api.get('/sections');
      return res.data;
    },
  });

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setBody(article.body);
      setSectionId(article.sectionId);
    }
  }, [article]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return api.post('/articles', { title, body, sectionId });
      } else {
        return api.patch(`/articles/${id}`, { title, body });
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      if (isNew) navigate(`/articles/${res.data.id}`);
      else queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      return api.post(`/articles/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  const isEditor = user?.role === 'EDITOR';
  const status = article?.status || 'DRAFT';
  const canEdit = isNew || status === 'DRAFT' || status === 'IN_REVIEW' || status === 'APPROVED' || status === 'SCHEDULED';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {isNew ? 'New Article' : 'Edit Article'}
        </h2>
        {!isNew && (
          <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            disabled={!canEdit}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
          />
        </div>

        {isNew && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Section</label>
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
            >
              <option value="">Select a section</option>
              {sections?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Content</label>
          <textarea
            disabled={!canEdit}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={15}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2 font-mono"
          />
        </div>

        <div className="flex items-center space-x-4 border-t border-gray-200 pt-4">
          {canEdit && (
            <button
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="mr-2 h-4 w-4" /> Save
            </button>
          )}

          {!isNew && status === 'DRAFT' && (
            <button
              onClick={() => actionMutation.mutate('submit')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Send className="mr-2 h-4 w-4" /> Submit for Review
            </button>
          )}

          {!isNew && status === 'IN_REVIEW' && isEditor && user?.id !== article?.authorId && (
            <button
              onClick={() => actionMutation.mutate('approve')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Approve
            </button>
          )}

          {!isNew && status === 'APPROVED' && isEditor && (
            <>
              <button
                onClick={() => actionMutation.mutate('publish')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Globe className="mr-2 h-4 w-4" /> Publish Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
