
import React, { useState, useEffect, createContext, useContext } from 'react';
import { LayoutDashboard, Mic, MessageSquare, Library, Menu, X, Languages, Scan, Video, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SpeechAnalyzer from './components/SpeechAnalyzer';
import VisualAnalyzer from './components/VisualAnalyzer';
import DebateArena from './components/DebateArena';
import LearningCenter from './components/LearningCenter';
import Resources from './components/Resources';
import LandingPage from './components/LandingPage';
import { AppView, Language, HistoryItem, UserProgress } from './types';
import { translations } from './locales';

// Domestic Helper Functions (Proxied via backend, no VPN needed)
const fetchUserProfile = async (uid: string) => {
  const res = await fetch(`/api/db/user/${uid}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
};

const fetchUserHistory = async (uid: string) => {
  const res = await fetch(`/api/db/history/${uid}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
};

const domesticLogin = async (email: string) => {
  console.log(`Attempting domestic login for: ${email}`);
  try {
    const res = await fetch("/api/auth/domestic-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${res.status}`);
    }
    
    const data = await res.json();
    console.log("Login successful:", data);
    return data;
  } catch (err) {
    console.error("fetch(/api/auth/domestic-login) collapsed:", err);
    throw err;
  }
};

// Auth Context
interface AuthContextType {
  user: any | null;
  loading: boolean;
  progress: UserProgress | null;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  progress: null,
  refreshData: async () => {}
});

export const useAuth = () => useContext(AuthContext);

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<Language>('zh');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  
  // Auth & Progress State
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [apiStatus, setApiStatus] = useState<{ isConfigured: boolean; baseUrl: string; model: string } | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);

  const refreshData = async () => {
    const storedUid = localStorage.getItem('domestic_uid');
    if (storedUid) {
      try {
        const [profile, hist] = await Promise.all([
          fetchUserProfile(storedUid),
          fetchUserHistory(storedUid)
        ]);
        setProgress(profile);
        setHistory(hist);
      } catch (err) {
        console.error("Refresh failed", err);
      }
    }
  };

  const handleDomesticLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    
    console.log("Initiating login for:", loginEmail);
    try {
      setLoading(true);
      const data = await domesticLogin(loginEmail);
      
      localStorage.setItem('domestic_uid', data.uid);
      setUser(data);
      setShowLoginModal(false);
      
      // If landing page, go to dashboard
      if (currentView === AppView.LANDING) {
        console.log("Navigating to dashboard...");
        setCurrentView(AppView.DASHBOARD);
      }

      // Show warning if database is slow but login succeeded (emergency session)
      if (data.warning) {
        alert("⚠️ " + data.warning);
      }

      // Background data refresh
      refreshData()
        .catch(err => console.error("Initial data fetch background error:", err))
        .finally(() => setLoading(false));
      
    } catch (err: any) {
      console.error("Critical Login Error:", err);
      setLoading(false);
      
      let errorMsg = `登录失败: ${err.message || "服务器响应异常"}`;
      if (err.message === 'DATABASE_TIMEOUT') {
        errorMsg = "数据库响应超时（Vercel 限制），但已为您开启紧急本地模式，请刷新。";
      } else if (err.message && (err.message.includes('permission') || err.message.includes('insufficient'))) {
        errorMsg = "云端权限受限，已切换至本地数据模式。";
      } else if (err.message && err.message.includes('FAILED_TO_FETCH')) {
        errorMsg = "无法连接到后端接口，请确认 Vercel 部署已完成且环境变量已配置。";
      }
      
      alert(errorMsg);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('domestic_uid');
    setUser(null);
    setProgress(null);
    setHistory([]);
    setCurrentView(AppView.LANDING);
  };

  const checkServer = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setServerHealthy(true);
      else setServerHealthy(false);
    } catch (err) {
      setServerHealthy(false);
    }
  };

  useEffect(() => {
    checkServer();
    fetch("/api/config-check")
      .then(res => res.json())
      .then(data => setApiStatus(data))
      .catch(err => console.error("Failed to check API status", err));

    const storedUid = localStorage.getItem('domestic_uid');
    if (storedUid) {
      fetchUserProfile(storedUid)
        .then(profile => {
          setUser(profile);
          return fetchUserHistory(storedUid);
        })
        .then(hist => setHistory(hist))
        .catch(err => {
          console.warn("Auto-login failed, maybe session expired or no VPN (if using old SDK)", err);
          localStorage.removeItem('domestic_uid');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const t = translations[lang];

  const toggleLanguage = () => {
    setLang(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${
        currentView === view
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
          : 'text-slate-500 hover:bg-white hover:text-slate-800'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (currentView === AppView.LANDING) {
    return (
      <AuthContext.Provider value={{ user, loading, progress, refreshData }}>
        <LandingPage 
          onStart={() => {
            if (user) setCurrentView(AppView.DASHBOARD);
            else setShowLoginModal(true);
          }} 
          lang={lang} 
        />
        {/* Global Login Modal for Landing */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                   <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                   <p className="text-slate-600 font-medium tracking-tight">正在同步您的云端账号...</p>
                </div>
              )}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">账号登录</h3>
                <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleDomesticLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">电子邮箱</label>
                  <input 
                    type="email" 
                    required 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="yourname@domain.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? '同步中...' : '确认登录'}
                </button>
                <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed">
                  您的学习进度和历史记录将与此邮箱永久绑定。
                </p>
              </form>
            </div>
          </div>
        )}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, progress, refreshData }}>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 transition-colors duration-300 relative">
        {/* Sidebar Navigation (Desktop) */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-50 border-r border-slate-200 p-6 fixed h-full z-10 transition-all duration-300">
          <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => setCurrentView(AppView.LANDING)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-md">
              <span className="text-white font-bold text-xl">D</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t.common.appName}</h1>
          </div>

          <nav className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label={t.nav.dashboard} />
            <NavItem view={AppView.SPEECH_ANALYSIS} icon={Mic} label={t.nav.speech} />
            <NavItem view={AppView.VISUAL_ANALYSIS} icon={Scan} label={t.nav.visual} />
            <NavItem view={AppView.DEBATE_SIMULATOR} icon={MessageSquare} label={t.nav.debate} />
            <NavItem view={AppView.LEARNING_CENTER} icon={Video} label={t.nav.learning} />
            <NavItem view={AppView.RESOURCES} icon={Library} label={t.nav.resources} />
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200 space-y-4">
            {/* Language Toggle */}
            <button 
              onClick={toggleLanguage}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                  <Languages size={16} />
                  <span>{lang === 'zh' ? '中文' : 'English'}</span>
              </div>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">Switch</span>
            </button>

            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm flex items-center justify-center text-white font-bold">
                    {user.displayName?.[0] || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[120px]">{user.displayName || t.common.welcome}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t.common.plan}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all"
              >
                <LogIn size={18} />
                <span>Login</span>
              </button>
            )}
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2" onClick={() => setCurrentView(AppView.LANDING)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900">{t.common.appName}</h1>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={toggleLanguage} className="text-slate-600">
                  <Languages size={20} />
              </button>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-slate-50 z-10 pt-20 px-6 space-y-4 animate-in slide-in-from-top-10 duration-200 overflow-y-auto">
            <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label={t.nav.dashboard} />
            <NavItem view={AppView.SPEECH_ANALYSIS} icon={Mic} label={t.nav.speech} />
            <NavItem view={AppView.VISUAL_ANALYSIS} icon={Scan} label={t.nav.visual} />
            <NavItem view={AppView.DEBATE_SIMULATOR} icon={MessageSquare} label={t.nav.debate} />
            <NavItem view={AppView.LEARNING_CENTER} icon={Video} label={t.nav.learning} />
            <NavItem view={AppView.RESOURCES} icon={Library} label={t.nav.resources} />
            
            <div className="pt-4 border-t border-slate-200">
              {user ? (
                <button onClick={handleLogout} className="flex items-center gap-2 text-red-600 font-medium">
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              ) : (
                <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 text-indigo-600 font-medium">
                  <LogIn size={20} />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        )}

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* Server Health Warning */}
            {serverHealthy === false && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 shadow-sm">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-900">无法连接到后端服务器</h4>
                  <p className="text-xs text-red-700 mt-1">
                    这可能是由于网络波动或服务器正在重启。请尝试刷新页面或点击下方按钮重试。
                  </p>
                  <button 
                    onClick={checkServer}
                    className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                  >
                    重试连接
                  </button>
                </div>
              </div>
            )}

            {/* API Configuration Warning */}
            {apiStatus && !apiStatus.isConfigured && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Languages size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900">AI 服务未配置</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    请在左侧菜单栏底部的 <b>Settings (设置)</b> 中添加环境变量 <b>OPENAI_API_KEY</b> 以启用 AI 功能。
                  </p>
                  <div className="mt-2 flex gap-4 text-[10px] font-mono text-amber-600">
                    <span>Base URL: {apiStatus.baseUrl}</span>
                    <span>Model: {apiStatus.model}</span>
                  </div>
                </div>
              </div>
            )}

            {!user && currentView !== AppView.LANDING ? (
                 <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                   <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                     <LogIn size={40} className="text-indigo-600" />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-800 mb-2">欢迎回来</h2>
                   <p className="text-slate-500 mb-8 max-w-md">请登录您的账户以同步训练数据和进阶分析进度。</p>
                   <button 
                     onClick={() => setShowLoginModal(true)}
                     className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:bg-indigo-700 transition-all"
                   >
                     点击登录
                   </button>
                 </div>
            ) : (
              <>
                {currentView === AppView.DASHBOARD && <Dashboard lang={lang} history={history} />}
                {currentView === AppView.SPEECH_ANALYSIS && <SpeechAnalyzer lang={lang} />}
                {currentView === AppView.VISUAL_ANALYSIS && <VisualAnalyzer lang={lang} />}
                {currentView === AppView.DEBATE_SIMULATOR && <DebateArena lang={lang} />}
                {currentView === AppView.LEARNING_CENTER && <LearningCenter lang={lang} />}
                {currentView === AppView.RESOURCES && <Resources lang={lang} />}
              </>
            )}
          </div>
        </main>

        {/* Global Login Modal for Dashboard View */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                   <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                   <p className="text-slate-600 font-medium">正在同步您的云端账号...</p>
                </div>
              )}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">账号登录</h3>
                <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleDomesticLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">电子邮箱</label>
                  <input 
                    type="email" 
                    required 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="yourname@domain.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? '同步中...' : '确认登录'}
                </button>
                <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed">
                  您的学习进度和历史记录将与此邮箱永久绑定。
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default App;
