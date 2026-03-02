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
        <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        )}
      </div>
      {aside}
    </div>
  );
};

export default SectionHeader;
