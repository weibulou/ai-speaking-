import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Trophy, TrendingUp, Activity, BookOpen } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../locales';

const radarData = [
  { subject: 'Logic', A: 120, fullMark: 150 },
  { subject: 'Rhetoric', A: 98, fullMark: 150 },
  { subject: 'Evidence', A: 86, fullMark: 150 },
  { subject: 'Fluency', A: 99, fullMark: 150 },
  { subject: 'Rebuttal', A: 85, fullMark: 150 },
  { subject: 'Structure', A: 65, fullMark: 150 },
];

const progressData = [
  { name: 'W1', score: 65 },
  { name: 'W2', score: 70 },
  { name: 'W3', score: 68 },
  { name: 'W4', score: 75 },
  { name: 'W5', score: 82 },
  { name: 'W6', score: 88 },
];

interface DashboardProps {
  lang: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ lang }) => {
  const t = translations[lang].dashboard;

  return (
    <div className="space-y-6 fade-in pb-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.totalExercises}</p>
            <h3 className="text-2xl font-bold text-slate-800">24</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-green-100 text-green-600 rounded-full">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.avgScore}</p>
            <h3 className="text-2xl font-bold text-slate-800">78.5</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.winRate}</p>
            <h3 className="text-2xl font-bold text-slate-800">60%</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.concepts}</p>
            <h3 className="text-2xl font-bold text-slate-800">12</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart for Skills */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">{t.competency}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} />
                <Radar
                  name="Current Level"
                  dataKey="A"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.4}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart for Progress */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">{t.progress}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={progressData}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Activity Log (New Section) */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{t.activity}</h3>
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">{lang === 'zh' ? '完成了一次即兴演讲练习' : 'Completed an impromptu speech'}</p>
                            <p className="text-xs text-slate-500">2 hours ago</p>
                        </div>
                    </div>
                    <span className="text-sm font-bold text-indigo-600">+15 XP</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
