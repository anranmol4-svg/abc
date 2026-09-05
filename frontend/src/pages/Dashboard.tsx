import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Clock, CheckCircle, Edit3 } from 'lucide-react';

interface DashboardData {
  metrics: {
    inReview: number;
    scheduledThisWeek: number;
    publishedThisWeek: number;
    openDrafts: number;
  };
  statusBreakdown: { name: string; value: number }[];
  sectionBreakdown: { name: string; value: number }[];
  eightWeekChart: { week: string; published: number }[];
}

const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className={`h-6 w-6 ${colorClass}`} aria-hidden="true" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd>
              <div className="text-lg font-medium text-gray-900">{value}</div>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

export const Dashboard = () => {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
  });

  if (isLoading) return <div className="text-gray-500">Loading dashboard metrics...</div>;
  if (error || !data) return <div className="text-red-500">Failed to load dashboard</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">Overview</h2>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Open Drafts" value={data.metrics.openDrafts} icon={Edit3} colorClass="text-gray-400" />
        <StatCard title="In Review" value={data.metrics.inReview} icon={Clock} colorClass="text-yellow-500" />
        <StatCard title="Scheduled (This Week)" value={data.metrics.scheduledThisWeek} icon={FileText} colorClass="text-blue-500" />
        <StatCard title="Published (This Week)" value={data.metrics.publishedThisWeek} icon={CheckCircle} colorClass="text-green-500" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Eight Week Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Publication Trend (Last 8 Weeks)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.eightWeekChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="published" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdowns */}
        <div className="space-y-5">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Articles by Status</h3>
            <div className="space-y-3">
              {data.statusBreakdown.length === 0 ? <p className="text-gray-500 text-sm">No articles found.</p> : null}
              {data.statusBreakdown.map(item => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Articles by Section</h3>
            <div className="space-y-3">
              {data.sectionBreakdown.length === 0 ? <p className="text-gray-500 text-sm">No articles found.</p> : null}
              {data.sectionBreakdown.map(item => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
