import React from 'react';
import { Book, PlayCircle, FileText, ExternalLink } from 'lucide-react';
import { ResourceItem, Language } from '../types';
import { translations } from '../locales';

const mockResources: ResourceItem[] = [
  {
    id: '1',
    title: 'Mastering Logical Fallacies',
    category: 'Logic',
    difficulty: 'Medium',
    description: 'Learn to identify and avoid common logical errors like Ad Hominem and Straw Man.'
  },
  {
    id: '2',
    title: 'The Art of Rhetoric: Aristotle',
    category: 'Rhetoric',
    difficulty: 'Hard',
    description: 'Deep dive into Ethos, Pathos, and Logos for persuasive speech delivery.'
  },
  {
    id: '3',
    title: 'Evidence Types: Anecdotal vs Empirical',
    category: 'Evidence',
    difficulty: 'Easy',
    description: 'Understanding which type of evidence strengthens your argument in different contexts.'
  },
  {
    id: '4',
    title: 'Impromptu Speaking Drills',
    category: 'Delivery',
    difficulty: 'Medium',
    description: '5-minute exercises to boost your thinking speed and fluency under pressure.'
  }
];

interface ResourcesProps {
  lang: Language;
}

const Resources: React.FC<ResourcesProps> = ({ lang }) => {
  const t = translations[lang].resources;

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.title}</h2>
          <p className="text-slate-500">{t.subtitle}</p>
        </div>
        <div className="hidden md:block">
           <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{t.recommend}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockResources.map((resource) => (
          <div key={resource.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all group cursor-pointer hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${
                resource.category === 'Logic' ? 'bg-blue-100 text-blue-600' :
                resource.category === 'Rhetoric' ? 'bg-purple-100 text-purple-600' :
                resource.category === 'Evidence' ? 'bg-green-100 text-green-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                {resource.category === 'Logic' ? <Book size={20} /> :
                 resource.category === 'Rhetoric' ? <PlayCircle size={20} /> :
                 <FileText size={20} />}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                resource.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                resource.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {resource.difficulty}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
              {resource.title}
            </h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              {resource.description}
            </p>

            <div className="flex items-center text-sm text-indigo-600 font-medium">
              {t.start} <ExternalLink size={14} className="ml-1 group-hover:ml-2 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Resources;
