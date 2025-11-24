export enum AppView {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  SPEECH_ANALYSIS = 'SPEECH_ANALYSIS',
  DEBATE_SIMULATOR = 'DEBATE_SIMULATOR',
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
