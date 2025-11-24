import React, { useState } from 'react';
import { LayoutDashboard, Mic, MessageSquare, Library, Menu, X, Languages } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SpeechAnalyzer from './components/SpeechAnalyzer';
import DebateArena from './components/DebateArena';
import Resources from './components/Resources';
import LandingPage from './components/LandingPage';
import { AppView, Language } from './types';
import { translations } from './locales';

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<Language>('zh');

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
    return <LandingPage onStart={() => setCurrentView(AppView.DASHBOARD)} lang={lang} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 transition-colors duration-300">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-50 border-r border-slate-200 p-6 fixed h-full z-10 transition-all duration-300">
        <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => setCurrentView(AppView.LANDING)}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-md">
            <span className="text-white font-bold text-xl">D</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t.common.appName}</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label={t.nav.dashboard} />
          <NavItem view={AppView.SPEECH_ANALYSIS} icon={Mic} label={t.nav.speech} />
          <NavItem view={AppView.DEBATE_SIMULATOR} icon={MessageSquare} label={t.nav.debate} />
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

          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm"></div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t.common.welcome}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t.common.plan}</p>
            </div>
          </div>
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
        <div className="md:hidden fixed inset-0 bg-slate-50 z-10 pt-20 px-6 space-y-4 animate-in slide-in-from-top-10 duration-200">
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label={t.nav.dashboard} />
          <NavItem view={AppView.SPEECH_ANALYSIS} icon={Mic} label={t.nav.speech} />
          <NavItem view={AppView.DEBATE_SIMULATOR} icon={MessageSquare} label={t.nav.debate} />
          <NavItem view={AppView.RESOURCES} icon={Library} label={t.nav.resources} />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {currentView === AppView.DASHBOARD && <Dashboard lang={lang} />}
          {currentView === AppView.SPEECH_ANALYSIS && <SpeechAnalyzer lang={lang} />}
          {currentView === AppView.DEBATE_SIMULATOR && <DebateArena lang={lang} />}
          {currentView === AppView.RESOURCES && <Resources lang={lang} />}
        </div>
      </main>
    </div>
  );
}

export default App;
