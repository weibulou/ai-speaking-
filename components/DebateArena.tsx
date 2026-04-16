import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Clock, ArrowRight, Swords } from 'lucide-react';
import { createDebateChat } from '../services/geminiService';
import { Message, Language } from '../types';
import { translations } from '../locales';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';

interface DebateArenaProps {
  lang: Language;
}

const DebateArena: React.FC<DebateArenaProps> = ({ lang }) => {
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [side, setSide] = useState<'proposition' | 'opposition'>('proposition');
  const [isStarted, setIsStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[lang].debate;

  const predefinedTopics = [
    "Social media does more harm than good.",
    "Artificial Intelligence should be regulated.",
    "Homework should be banned in schools.",
    "Globalization is beneficial for developing countries."
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStart = async () => {
    if (!topic || !user) return;
    
    const newSessionId = Date.now().toString();
    setSessionId(newSessionId);
    setIsStarted(true);
    
    // Initialize Gemini Chat
    chatRef.current = createDebateChat(topic, side);
    
    // Initial welcome message from system/judge context
    const welcomeMsg = t.welcomeMsg.replace('{topic}', topic).replace('{side}', side);

    const initialMsg: Message = {
      id: '0',
      role: 'model',
      text: welcomeMsg,
      timestamp: Date.now()
    };

    setMessages([initialMsg]);

    // Save initial message to Firestore
    try {
      await fetch("/api/db/save-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: 'debate_sessions',
          data: {
            sessionId: newSessionId,
            role: 'model',
            text: welcomeMsg,
            timestamp: initialMsg.timestamp,
            uid: user.uid
          }
        })
      });

      // Update user stats
      await fetch("/api/db/update-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          stats: { totalExercises: { _type: 'increment', value: 1 } }
        })
      });

      // Add to history
      await fetch("/api/db/save-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          historyItem: {
            uid: user.uid,
            type: 'debate',
            date: initialMsg.timestamp,
            summary: `Debate: ${topic}`,
            details: { topic, side, sessionId: newSessionId }
          }
        })
      });
    } catch (error) {
      console.error("Database proxy failed:", error);
      // Fallback
      try {
        await addDoc(collection(db, 'debate_sessions'), {
          sessionId: newSessionId,
          role: 'model',
          text: welcomeMsg,
          timestamp: initialMsg.timestamp,
          uid: user.uid
        });
        await updateDoc(doc(db, 'users', user.uid), {
          totalExercises: increment(1)
        });
        await addDoc(collection(db, `users/${user.uid}/history`), {
          uid: user.uid,
          type: 'debate',
          date: initialMsg.timestamp,
          summary: `Debate: ${topic}`,
          details: { topic, side, sessionId: newSessionId }
        });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, 'debate_sessions');
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current || !user || !sessionId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Save user message to Firestore
    try {
      await fetch("/api/db/save-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: 'debate_sessions',
          data: {
            sessionId,
            role: 'user',
            text: userMsg.text,
            timestamp: userMsg.timestamp,
            uid: user.uid
          }
        })
      });
    } catch (error) {
      console.error("Database proxy failed:", error);
      try {
        await addDoc(collection(db, 'debate_sessions'), {
          sessionId,
          role: 'user',
          text: userMsg.text,
          timestamp: userMsg.timestamp,
          uid: user.uid
        });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, 'debate_sessions');
      }
    }

    try {
      const result = await chatRef.current.sendMessageStream(userMsg.text);
      
      let fullText = '';
      const botMsgId = (Date.now() + 1).toString();
      const botTimestamp = Date.now();
      
      // Add placeholder for bot message
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        timestamp: botTimestamp
      }]);

      for await (const chunk of result) {
        const text = chunk.text();
        fullText += text;
        
        // Update the last message with the streaming chunk
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, text: fullText } : msg
        ));
      }

      // Save bot message to Firestore after streaming completes
      try {
        await fetch("/api/db/save-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection: 'debate_sessions',
            data: {
              sessionId,
              role: 'model',
              text: fullText,
              timestamp: botTimestamp,
              uid: user.uid
            }
          })
        });
      } catch (error) {
        console.error("Database proxy failed:", error);
        try {
          await addDoc(collection(db, 'debate_sessions'), {
            sessionId,
            role: 'model',
            text: fullText,
            timestamp: botTimestamp,
            uid: user.uid
          });
        } catch (firestoreErr) {
          handleFirestoreError(firestoreErr, OperationType.WRITE, 'debate_sessions');
        }
      }

    } catch (error) {
      console.error("Debate error", error);
      handleFirestoreError(error, OperationType.WRITE, 'debate_sessions');
    } finally {
      setIsTyping(false);
    }
  };

  if (!isStarted) {
    return (
      <div className="fade-in max-w-3xl mx-auto py-10">
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-slate-100">
          <div className="text-center mb-10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-20 h-20 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center mx-auto mb-6 transform rotate-3 hover:rotate-6 transition-transform">
              <Swords className="text-white" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-slate-800">{t.title}</h2>
            <p className="text-slate-500 mt-2 text-lg">{t.subtitle}</p>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">{t.selectTopic}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {predefinedTopics.map(item => (
                  <button
                    key={item}
                    onClick={() => setTopic(item)}
                    className={`text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 border ${
                      topic === item 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm ring-2 ring-indigo-500/20' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={t.customTopic}
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-shadow"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">{t.chooseSide}</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setSide('proposition')}
                  className={`flex-1 py-4 px-4 rounded-xl font-bold border-2 transition-all ${
                    side === 'proposition' 
                      ? 'bg-blue-50 text-blue-700 border-blue-600 shadow-md' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t.prop}
                </button>
                <button
                  onClick={() => setSide('opposition')}
                  className={`flex-1 py-4 px-4 rounded-xl font-bold border-2 transition-all ${
                    side === 'opposition' 
                      ? 'bg-rose-50 text-rose-700 border-rose-600 shadow-md' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t.opp}
                </button>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!topic}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all hover:shadow-lg active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {t.enter} <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      {/* Header */}
      <div className="bg-slate-900 p-4 flex items-center justify-between text-white shadow-md z-10">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${side === 'proposition' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
            <div>
                <h3 className="font-bold flex items-center gap-2">{t.inProgress}</h3>
                <p className="text-xs text-slate-400 truncate max-w-md opacity-80">{topic}</p>
            </div>
        </div>
        <button 
          onClick={() => setIsStarted(false)} 
          className="text-xs bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors font-medium backdrop-blur-sm"
        >
          {t.endSession}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 scrollbar-hide">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            style={{animation: 'fadeIn 0.3s ease-out'}}
          >
            <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-white border border-slate-200'
              }`}>
                {msg.role === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-slate-600" />}
              </div>
              <div>
                <div className={`p-5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-slate-200'
                }`}>
                  {msg.text}
                </div>
                <div className={`text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <Clock size={10} />
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start fade-in">
             <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                 <Bot size={18} className="text-slate-600" />
               </div>
               <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-1">
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 transition-all focus:bg-white"
            placeholder={t.typeArg}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-indigo-600 text-white px-6 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-200"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebateArena;
