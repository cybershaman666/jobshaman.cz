import React, { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';

// Simple page components for legal pages - no routing, just static pages
const LegalPage = ({ title, children, icon: Icon, backLink = "/" }: { 
  title: string; 
  children: React.ReactNode; 
  icon?: React.ComponentType<any>;
  backLink?: string; 
}) => {
  useEffect(() => {
    window.scrollTo(0, 0);
    // Update page title
    document.title = `${title} | JobShaman`;
  }, [title]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
                <Icon className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                {title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
          {children}
        </div>
      </div>

      {/* Back to App */}
      <div className="text-center mt-8">
        <a 
          href={backLink}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
        >
          <ArrowUpRight className="w-5 h-5" />
          Zpět do aplikace
        </a>
      </div>
    </div>
  );
};

export default LegalPage;