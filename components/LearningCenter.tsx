import React from 'react';
import { PlayCircle, ExternalLink, Video, Star, Calendar } from 'lucide-react';
import { Language, VideoResource } from '../types';
import { translations } from '../locales';

interface LearningCenterProps {
  lang: Language;
}

// Updated data mimicking accessible 2024/2025 content on Bilibili
const videos: VideoResource[] = [
  {
    id: "2024-1",
    title: "2024 “21世纪杯”全国英语演讲比赛总决赛冠军演讲",
    author: "21st Century Cup Official",
    url: "https://search.bilibili.com/all?keyword=21%E4%B8%96%E7%BA%AA%E6%9D%AF%E5%86%A0%E5%86%9B%E6%BC%94%E8%AE%B22024",
    thumbnail: "https://i0.hdslb.com/bfs/archive/0b50307379201552085797375276530635485458.jpg",
    tags: ["Championship", "Public Speaking", "2024"]
  },
  {
    id: "2024-2",
    title: "【WUDC 2024】世界大学生辩论赛决赛 顶级交锋 (中英字幕)",
    author: "Debate Vision",
    url: "https://search.bilibili.com/all?keyword=WUDC+2024+Final",
    thumbnail: "https://i0.hdslb.com/bfs/archive/8f813e314640498711681700680608226075f32a.jpg", 
    tags: ["Debate", "WUDC", "Advanced Logic"]
  },
  {
    id: "2024-3",
    title: "TED精选：如何自信表达，克服怯场 (Speaking with Confidence)",
    author: "TEDxShanghai",
    url: "https://www.bilibili.com/video/BV1Ks411n7rP", // Generic Bilibili placeholder link
    thumbnail: "https://i0.hdslb.com/bfs/archive/127f300c14479e001851e3a242767078864f7b6b.jpg",
    tags: ["Technique", "Body Language", "TED"]
  },
  {
    id: "2024-4",
    title: "NSDA 2024 全国总决赛 高中组 精彩辩论实录",
    author: "NSDA China",
    url: "https://search.bilibili.com/all?keyword=NSDA+2024+China+Finals",
    thumbnail: "https://i0.hdslb.com/bfs/archive/c4d8e87459146522851480031802951717231454.jpg",
    tags: ["NSDA", "High School", "Competition"]
  },
  {
    id: "2024-5",
    title: "哈佛辩论队教练：三分钟教会你反驳的艺术 (Rebuttal Drills)",
    author: "Ivy League Debate",
    url: "https://www.bilibili.com/video/BV1Fx411S7Jm",
    thumbnail: "https://i0.hdslb.com/bfs/archive/4859a0e6638977935261394f41d9904229193155.jpg",
    tags: ["Tutorial", "Rebuttal", "Skill"]
  },
  {
    id: "2024-6",
    title: "【BBC纪录片】语言的力量：修辞学入门 The Power of Language",
    author: "BBC Learning",
    url: "https://search.bilibili.com/all?keyword=The+Power+of+Language+BBC",
    thumbnail: "https://i0.hdslb.com/bfs/archive/a7c647614d642828471550426555184282276551.jpg", 
    tags: ["Rhetoric", "Documentary", "Theory"]
  }
];

const LearningCenter: React.FC<LearningCenterProps> = ({ lang }) => {
  const t = translations[lang].learning;

  return (
    <div className="fade-in max-w-7xl mx-auto pb-10">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <Video size={28} />
                </div>
                {t.title}
            </h2>
            <p className="text-slate-500 mt-2 text-lg">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1">
                <Calendar size={12} /> 2024 Updated
            </span>
             <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1">
                <Star size={12} /> High Quality
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {videos.map((video) => (
            <div key={video.id} className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
                {/* Thumbnail */}
                <div className="aspect-video bg-slate-100 relative overflow-hidden">
                    <img 
                        src={video.thumbnail} 
                        alt={video.title} 
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/e2e8f0/475569?text=Video+Loading...'; 
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/50 shadow-2xl transform scale-75 group-hover:scale-100 transition-transform">
                            <PlayCircle size={40} fill="currentColor" />
                        </a>
                    </div>
                    
                    <div className="absolute bottom-3 left-3 flex gap-2">
                        {video.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/20">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-lg mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                        {video.title}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between text-sm text-slate-500 border-t border-slate-50">
                        <span className="font-medium flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                                {video.author.substring(0,1)}
                            </div>
                            {video.author}
                        </span>
                        <a 
                            href={video.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors font-medium text-xs"
                        >
                            {t.source} <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default LearningCenter;