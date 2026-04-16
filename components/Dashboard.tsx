
import React, { useMemo } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Trophy, TrendingUp, Activity, BookOpen, Mic, Scan } from 'lucide-react';
import { Language, HistoryItem } from '../types';
import { translations } from '../locales';
import { useAuth } from '../App';

interface DashboardProps {
  lang: Language;
  history: HistoryItem[];
}

const Dashboard: React.FC<DashboardProps> = ({ lang, history }) => {
  const { progress } = useAuth();
  const t = translations[lang].dashboard;

  // Calculate Metrics based on History
  const metrics = useMemo(() => {
    const speechItems = history.filter(h => h.type === 'speech');
    const visualItems = history.filter(h => h.type === 'visual');
    const totalExercises = history.length;
    
    // Average Score (only from speech currently)
    const totalScore = speechItems.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const avgScore = speechItems.length > 0 ? (totalScore / speechItems.length).toFixed(1) : '0.0';

    // Skill Radar Data (Aggregating from speech details)
    // We start with base values so the chart isn't empty initially
    let radarStats = {
      logic: 60,
      rhetoric: 60,
      evidence: 60,
      fluency: 60,
      structure: 60,
      count: 0
    };

    speechItems.forEach(item => {
        if (item.details) {
            radarStats.logic += item.details.logicScore || 0;
            radarStats.rhetoric += item.details.argumentScore || 0; // Mapping argument to rhetoric for now
            radarStats.evidence += item.details.argumentScore || 0;
            radarStats.fluency += item.details.fluencyScore || 0;
            radarStats.structure += item.details.logicScore || 0;
            radarStats.count++;
        }
    });

    const divisor = radarStats.count || 1; // Avoid division by zero, but if 0, we just show base 60
    // If count is > 0, we subtract the base 60*count from sum? No, simpler logic:
    // If we have data, recalculate. 
    // Let's just average the raw scores from history if available, else show default mock.
    
    let radarData;
    if (progress?.skillRadar) {
        radarData = [
            { subject: 'Logic', A: progress.skillRadar.logic, fullMark: 100 },
            { subject: 'Rhetoric', A: progress.skillRadar.rhetoric, fullMark: 100 },
            { subject: 'Evidence', A: progress.skillRadar.evidence, fullMark: 100 },
            { subject: 'Fluency', A: progress.skillRadar.fluency, fullMark: 100 },
            { subject: 'Structure', A: progress.skillRadar.structure, fullMark: 100 },
        ];
    } else if (radarStats.count > 0) {
        // Reset base to 0 for calculation
         radarStats = {
          logic: 0,
          rhetoric: 0,
          evidence: 0,
          fluency: 0,
          structure: 0,
          count: 0
        };
        speechItems.forEach(item => {
            if (item.details) {
                radarStats.logic += item.details.logicScore || 0;
                radarStats.rhetoric += item.details.argumentScore || 0; 
                radarStats.evidence += item.details.argumentScore || 0;
                radarStats.fluency += item.details.fluencyScore || 0;
                radarStats.structure += item.details.logicScore || 0;
                radarStats.count++;
            }
        });
        radarData = [
            { subject: 'Logic', A: Math.round(radarStats.logic / radarStats.count), fullMark: 100 },
            { subject: 'Rhetoric', A: Math.round(radarStats.rhetoric / radarStats.count), fullMark: 100 },
            { subject: 'Evidence', A: Math.round(radarStats.evidence / radarStats.count), fullMark: 100 },
            { subject: 'Fluency', A: Math.round(radarStats.fluency / radarStats.count), fullMark: 100 },
            { subject: 'Structure', A: Math.round(radarStats.structure / radarStats.count), fullMark: 100 },
        ];
    } else {
        // Default Mock Data if no history
        radarData = [
            { subject: 'Logic', A: 65, fullMark: 100 },
            { subject: 'Rhetoric', A: 70, fullMark: 100 },
            { subject: 'Evidence', A: 60, fullMark: 100 },
            { subject: 'Fluency', A: 80, fullMark: 100 },
            { subject: 'Structure', A: 55, fullMark: 100 },
        ];
    }

    // Progress Line Chart Data (Last 5 attempts)
    const progressData = speechItems
        .slice(0, 5)
        .reverse() // Oldest first
        .map((item, idx) => ({
            name: `Ex ${idx + 1}`,
            score: item.score || 0
        }));
    
    // Fill with empty if not enough data
    if (progressData.length === 0) {
        progressData.push({ name: 'Start', score: 0 });
    }

    return {
        totalExercises,
        avgScore,
        radarData,
        progressData,
        recentActivity: history.slice(0, 5) // Last 5 items
    };
  }, [history]);

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
            <h3 className="text-2xl font-bold text-slate-800">{progress?.totalExercises || metrics.totalExercises}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-green-100 text-green-600 rounded-full">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.avgScore}</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {progress?.speechCount && progress.speechCount > 0 
                ? ((progress.speechScoreSum || 0) / progress.speechCount).toFixed(1) 
                : metrics.avgScore}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.winRate}</p>
            <h3 className="text-2xl font-bold text-slate-800">-- %</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-transform hover:scale-[1.02] cursor-default">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t.concepts}</p>
            <h3 className="text-2xl font-bold text-slate-800">5</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart for Skills */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">{t.competency}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={metrics.radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
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
                data={metrics.progressData}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Activity Log (Real Data) */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{t.activity}</h3>
        {metrics.recentActivity.length > 0 ? (
            <div className="space-y-4">
                {metrics.recentActivity.map((item, i) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg animate-in slide-in-from-right-5" style={{animationDelay: `${i*100}ms`}}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${item.type === 'speech' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                                {item.type === 'speech' ? <Mic size={16} /> : <Scan size={16} />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    {item.type === 'speech' 
                                        ? (lang === 'zh' ? '演讲分析完成' : 'Speech Analysis Completed') 
                                        : (lang === 'zh' ? '视觉体态诊断完成' : 'Visual Diagnosis Completed')}
                                </p>
                                <p className="text-xs text-slate-500">{new Date(item.date).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        {item.score && (
                            <span className={`text-sm font-bold ${item.score >= 80 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                {item.score} pts
                            </span>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
                {lang === 'zh' ? '暂无活动记录，快去开始练习吧！' : 'No recent activity. Start practicing!'}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
