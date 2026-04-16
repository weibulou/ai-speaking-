
import React, { useState, useRef } from 'react';
import { Mic, Square, Play, RotateCcw, CheckCircle, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { analyzeSpeechContent, generateRandomTopic } from '../services/geminiService';
import { AnalysisResult, Language, HistoryItem } from '../types';
import { translations } from '../locales';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';

interface SpeechAnalyzerProps {
  lang: Language;
}

const SpeechAnalyzer: React.FC<SpeechAnalyzerProps> = ({ lang }) => {
  const { user, progress } = useAuth();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const t = translations[lang].speech;

  const startRecording = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US'; // Keep input as English for English debate

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
             setText(prev => prev + ' ' + finalTranscript);
        }
      };

      recognitionRef.current.start();
      setIsRecording(true);
    } else {
      alert("Browser does not support Web Speech API. Please type your speech.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleAnalyze = async () => {
    if (!text.trim() || !user) return;
    setIsAnalyzing(true);
    try {
      const data = await analyzeSpeechContent(text);
      setResult(data);
      
      // Save to history in Firestore
      const historyPath = `users/${user.uid}/history`;
      const historyItem: Omit<HistoryItem, 'id'> = {
        uid: user.uid,
        type: 'speech',
        date: Date.now(),
        score: data.score,
        summary: data.summary,
        details: data
      };
      
      try {
        // Use server-side proxy for database writes to avoid client-side network issues
        await fetch("/api/db/save-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, historyItem })
        });

        await fetch("/api/db/update-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            uid: user.uid, 
            stats: {
              totalExercises: { _type: 'increment', value: 1 },
              speechCount: { _type: 'increment', value: 1 },
              speechScoreSum: { _type: 'increment', value: data.score }
            }
          })
        });
      } catch (dbErr) {
        console.error("Database proxy failed:", dbErr);
        // Fallback to client-side if proxy fails (though proxy is meant to be more reliable)
        try {
          await addDoc(collection(db, historyPath), historyItem);
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            totalExercises: increment(1),
            speechCount: increment(1),
            speechScoreSum: increment(data.score),
            updatedAt: new Date().toISOString()
          });
        } catch (firestoreErr) {
          handleFirestoreError(firestoreErr, OperationType.WRITE, historyPath);
        }
      }

    } catch (err: any) {
      console.error("Analysis failed:", err);
      // If it's a fetch error, show a more specific message
      if (err.message === "Failed to fetch") {
        alert("无法连接到 AI 服务，请检查您的网络连接或稍后重试。");
      } else {
        alert("分析失败: " + err.message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateTopic = async () => {
    setIsGeneratingTopic(true);
    try {
        const topic = await generateRandomTopic();
        setText(prev => (prev ? prev + "\n\n" : "") + "Topic: " + topic + "\n\n");
    } catch(e) {
        console.error(e);
    } finally {
        setIsGeneratingTopic(false);
    }
  }

  return (
    <div className="fade-in max-w-6xl mx-auto pb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t.title}</h2>
        <p className="text-slate-500">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        {/* Input Section */}
        <div className="space-y-4 flex flex-col h-full">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
             <div className="flex justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Editor</span>
                <button 
                    onClick={handleGenerateTopic}
                    disabled={isGeneratingTopic}
                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-colors"
                >
                    <Sparkles size={12} /> {isGeneratingTopic ? '...' : t.genTopic}
                </button>
             </div>
            <textarea
              className="w-full flex-1 p-4 text-slate-700 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm leading-relaxed"
              placeholder={t.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            ></textarea>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Mic size={18} /> {t.record}
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors animate-pulse"
                  >
                    <Square size={18} /> {t.stop}
                  </button>
                )}
                <button
                  onClick={() => setText('')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RotateCcw size={18} /> {t.clear}
                </button>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !text.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all shadow-md ${
                  isAnalyzing || !text.trim()
                    ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:transform active:scale-95'
                }`}
              >
                {isAnalyzing ? t.analyzing : <> <Play size={18} /> {t.analyze} </>}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {result ? (
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 h-full overflow-y-auto max-h-[700px] fade-in custom-scrollbar">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold text-slate-800">{t.report}</h3>
                <div className={`px-4 py-2 rounded-lg font-bold text-xl ${
                    result.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                    result.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {result.score} <span className="text-sm font-normal opacity-70">/ 100</span>
                </div>
              </div>

              {/* Scores Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-xs text-slate-500 uppercase font-semibold mb-1">{t.logic}</div>
                  <div className="text-2xl font-bold text-slate-800">{result.logicScore}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-xs text-slate-500 uppercase font-semibold mb-1">{t.argument}</div>
                  <div className="text-2xl font-bold text-slate-800">{result.argumentScore}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-xs text-slate-500 uppercase font-semibold mb-1">{t.fluency}</div>
                  <div className="text-2xl font-bold text-slate-800">{result.fluencyScore}</div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-500"/> {t.summary}
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {result.summary}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-emerald-700 mb-2">
                    <CheckCircle size={18} /> {t.strengths}
                  </h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 marker:text-emerald-500">
                    {result.strengths.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>

                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-amber-600 mb-2">
                    <AlertTriangle size={18} /> {t.weaknesses}
                  </h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 marker:text-amber-500">
                    {result.weaknesses.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mt-6">
                  <h4 className="flex items-center gap-2 font-semibold text-indigo-700 mb-4 border-b border-slate-200 pb-2">
                     {t.structure}
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div><span className="font-bold block text-slate-800 mb-1">{t.intro}</span> <span className="text-slate-600 block pl-2 border-l-2 border-slate-200">{result.structureAnalysis.introduction}</span></div>
                    <div><span className="font-bold block text-slate-800 mb-1">{t.body}</span> <span className="text-slate-600 block pl-2 border-l-2 border-slate-200">{result.structureAnalysis.body}</span></div>
                    <div><span className="font-bold block text-slate-800 mb-1">{t.conclusion}</span> <span className="text-slate-600 block pl-2 border-l-2 border-slate-200">{result.structureAnalysis.conclusion}</span></div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
              <FileText size={48} className="mb-4 opacity-50" />
              <p>{t.noResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeechAnalyzer;
