
export enum AppView {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  SPEECH_ANALYSIS = 'SPEECH_ANALYSIS',
  VISUAL_ANALYSIS = 'VISUAL_ANALYSIS',
  DEBATE_SIMULATOR = 'DEBATE_SIMULATOR',
  LEARNING_CENTER = 'LEARNING_CENTER',
  RESOURCES = 'RESOURCES'
}

export type Language = 'zh' | 'en';

export interface AnalysisResult {
  score: number;
  logicScore: number;
  argumentScore: number;
  fluencyScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  structureAnalysis: {
    introduction: string;
    body: string;
    conclusion: string;
  };
  timestamp?: number; // Added for history
}

export interface VisualAnalysisResult {
  expression: string;
  posture: string;
  eyeContact: string;
  suggestions: string[];
  timestamp?: number; // Added for history
}

// New Interface for User History
export interface HistoryItem {
  id: string;
  uid?: string; // Added for Firestore
  type: 'speech' | 'visual' | 'debate';
  date: number;
  score?: number; // For speech
  summary: string; // For speech or visual summary
  details?: any; // Store full object if needed
}

export interface UserProgress {
  totalExercises: number;
  speechCount?: number;
  speechScoreSum?: number;
  averageScore: number;
  history: HistoryItem[];
  skillRadar: { subject: string; A: number; fullMark: number }[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ResourceItem {
  id: string;
  title: string;
  category: 'Logic' | 'Rhetoric' | 'Evidence' | 'Delivery';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
}

export interface VideoResource {
  id: string;
  title: string;
  author: string;
  url: string; 
  thumbnail: string;
  tags: string[];
}
