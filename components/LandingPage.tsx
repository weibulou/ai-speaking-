import React from 'react';
import { ArrowRight, Brain, Swords, LineChart, Globe } from 'lucide-react';
import { translations } from '../locales';
import { Language } from '../types';

interface LandingPageProps {
  onStart: () => void;
  lang: Language;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, lang }) => {
  const t = translations[lang].landing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500 rounded-full blur-[120px] opacity-20"></div>

      <div className="max-w-4xl w-full z-10 text-center space-y-12 fade-in">
        {/* Header */}
        <div className="space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 border border-white/10">
            <Globe className="text-indigo-300 mr-2" />
            <span className="font-semibold tracking-wide">DebateMaster AI</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-blue-200">
            {t.heroTitle}
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t.heroSubtitle}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-300 mb-4">
              <Brain size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t.feature1}</h3>
            <p className="text-sm text-slate-400">{t.desc1}</p>
          </div>
          <div className="p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-rose-500/20 rounded-lg flex items-center justify-center text-rose-300 mb-4">
              <Swords size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t.feature2}</h3>
            <p className="text-sm text-slate-400">{t.desc2}</p>
          </div>
          <div className="p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-300 mb-4">
              <LineChart size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t.feature3}</h3>
            <p className="text-sm text-slate-400">{t.desc3}</p>
          </div>
        </div>

        {/* CTA */}
        <div>
          <button
            onClick={onStart}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/30"
          >
            {translations[lang].common.startTraining}
            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
