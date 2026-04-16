
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Trophy, TrendingUp, Activity, BookOpen, Mic, Scan, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Language, HistoryItem } from '../types';
import { translations } from '../locales';
import { useAuth } from '../App';

interface DashboardProps {
  lang: Language;
  history: HistoryItem[];
}

const Dashboard: React.FC<DashboardProps> = ({ lang, history }) => {
  const { user, progress } = useAuth();
  const t = translations[lang].dashboard;
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiTest, setShowApiTest] = useState(true);

  const isAdmin = user?.email === "2969403672@qq.com";

  const testApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const res = await fetch("/api/test-api");
      const data = await res.json();
      if (data.success) {
        setApiTestResult({ success: true, message: "API 调用成功！模型响应正常。" });
      } else {
        setApiTestResult({ success: false, message: `API 调用失败: ${data.error}` });
      }
    } catch (err) {
      setApiTestResult({ success: false, message: "无法连接到后端服务器进行测试。" });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Calculate Metrics based on History
  const metrics = useMemo(() => {
    const speechItems = history.filter(h => h.type === 'speech');
    const visualItems = history.filter(h => h.type === 'visual');
    const totalExercises = history.length;
    
    // Average Score (only from speech currently)
    const totalScore = speechItems.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const avgScore = speechItems.length > 0 ? (totalScore / speechItems.length).toFixed(1) : '0.0';

    // Skill Radar Data (Aggregating from speech details)
    let radarStats = {
      logic: 0,
      rhetoric: 0,
      evidence: 0,
      fluency: 0,
      structure: 0,
      count: 0
    };

    speechItems.forEach(item => {
        if (item.details && typeof item.details === 'object') {
            radarStats.logic += item.details.logicScore || 0;
            radarStats.rhetoric += item.details.argumentScore || 0;
            radarStats.evidence += item.details.argumentScore || 0; // Using argument score for evidence too
            radarStats.fluency += item.details.fluencyScore || 0;
            radarStats.structure += item.details.logicScore || 0; // Using logic score for structure too
            radarStats.count++;
        }
    });

    let radarData;
    if (radarStats.count > 0) {
        radarData = [
            { subject: lang === 'zh' ? '逻辑' : 'Logic', A: Math.round(radarStats.logic / radarStats.count), fullMark: 100 },
            { subject: lang === 'zh' ? '修辞' : 'Rhetoric', A: Math.round(radarStats.rhetoric / radarStats.count), fullMark: 100 },
            { subject: lang === 'zh' ? '论证' : 'Evidence', A: Math.round(radarStats.evidence / radarStats.count), fullMark: 100 },
            { subject: lang === 'zh' ? '流畅' : 'Fluency', A: Math.round(radarStats.fluency / radarStats.count), fullMark: 100 },
            { subject: lang === 'zh' ? '结构' : 'Structure', A: Math.round(radarStats.structure / radarStats.count), fullMark: 100 },
        ];
    } else if (progress?.skillRadar && Array.isArray(progress.skillRadar)) {
        // Fallback to progress data if no history yet
        radarData = progress.skillRadar.map(s => ({
            subject: s.subject,
            A: s.A,
            fullMark: s.fullMark || 100
        }));
    } else {
        // Default Mock Data if absolutely nothing
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
      {/* Admin API Test Card */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 mb-2 overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" />
              API 连通性检查 (管理员专用)
            </h3>
            <button 
              onClick={() => setShowApiTest(!showApiTest)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title={showApiTest ? "隐藏面板" : "展开面板"}
            >
              {showApiTest ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {showApiTest && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 animate-in slide-in-from-top-2 duration-300">
              <div>
                <p className="text-slate-400 text-sm">
                  点击下方按钮测试当前配置的 AI 模型是否能正常响应。
                </p>
              </div>
              <div className="flex items-center gap-3">
                {apiTestResult && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${apiTestResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {apiTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {apiTestResult.message}
                  </div>
                )}
                <button 
                  onClick={testApi}
                  disabled={isTestingApi}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 rounded-xl transition-all font-medium text-sm shadow-lg shadow-indigo-500/20"
                >
                  <RefreshCw size={18} className={isTestingApi ? 'animate-spin' : ''} />
                  {isTestingApi ? '测试中...' : '立即测试 API'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
