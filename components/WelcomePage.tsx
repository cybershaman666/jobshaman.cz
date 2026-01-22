import React from 'react';
import { BrainCircuit, TrendingUp, Target } from 'lucide-react';

interface WelcomePageProps {
  title: string;
  subtitle: string;
  features: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: string;
  }>;
  primaryAction?: {
    text: string;
    onClick: () => void;
  };
  secondaryActions?: Array<{
    text: string;
    onClick: () => void;
  }>;
  stats?: Array<{
    value: string;
    label: string;
  }>;
}

const WelcomePage: React.FC<WelcomePageProps> = ({
  title,
  subtitle,
  features,
  primaryAction,
  secondaryActions,
  stats
}) => {

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
      {/* Header */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur border-b border-purple-100 dark:border-purple-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl">
              <BrainCircuit className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-900 to-violet-900 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-lg text-purple-700 dark:text-purple-300 mt-2">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats Section */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-purple-100 dark:border-purple-700">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {features.map((feature, index) => (
            <div key={index} className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-purple-100 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all hover:shadow-xl group">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    {feature.description}
                  </p>
                </div>
              </div>
              {feature.action && (
                <div className="mt-6">
                  <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg">
                    {feature.action}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Primary Action */}
        {primaryAction && (
          <div className="text-center">
            <button
              onClick={primaryAction.onClick}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {primaryAction.text}
            </button>
          </div>
        )}

        {/* Secondary Actions */}
        {secondaryActions && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            {secondaryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900 border-2 border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600 text-purple-700 dark:text-purple-300 font-semibold rounded-lg transition-all hover:shadow-md"
              >
                {action.text}
              </button>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="text-center mt-12 p-8 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
          <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">
            Začněte svou kariéru ještě dnes
          </h3>
          <p className="text-emerald-700 dark:text-emerald-300 max-w-2xl mx-auto mb-6">
            Objevte nové příležitosti, zvyšte si kvalifikaci a najděte si lepší práci v naší komunitní.
          </p>
          <button
            onClick={() => window.location.href = '/marketplace'}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            Prozkoumat kurzy a rekvalifikace
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;