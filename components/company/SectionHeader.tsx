import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  aside,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </div>
        )}
      </div>
      {aside}
    </div>
  );
};

export default SectionHeader;
