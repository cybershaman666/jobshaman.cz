import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

import { JDL_MOTION, type JdlSurfaceVariant, type JdlTone } from '../../src/design/jdl';

type ClassValue = string | false | null | undefined;

export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');

const SURFACE_VARIANTS: Record<JdlSurfaceVariant, string> = {
  quiet: 'app-surface',
  frost: 'app-surface app-frost-panel',
  spotlight: 'app-surface app-spotlight-panel',
  hero: 'app-page-hero app-hero-panel',
  spatial: 'app-surface app-spatial-panel',
  dock: 'app-surface app-dock-panel',
  danger: 'app-surface app-panel-danger',
};

const TONE_CLASSES: Record<JdlTone, string> = {
  default: '',
  muted: 'bg-[var(--surface-muted)]',
  accent: 'border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.08)]',
  success: 'border-[rgba(var(--accent-green-rgb),0.28)] bg-[rgba(var(--accent-green-rgb),0.08)]',
  warning: 'border-[rgba(var(--accent-gold-rgb),0.30)] bg-[rgba(var(--accent-gold-rgb),0.12)]',
  danger: 'border-[rgba(var(--danger-rgb),0.24)] bg-[rgba(var(--danger-rgb),0.08)]',
};

const BUTTON_VARIANTS: Record<JdlSurfaceVariant, string> = {
  quiet: 'app-button-secondary',
  frost: 'app-button-frost',
  spotlight: 'app-button-spotlight',
  hero: 'app-button-primary',
  spatial: 'app-button-frost',
  dock: 'app-button-dock',
  danger: 'app-button-danger',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm sm:text-base',
};

const resolveSurfaceVariant = (variant: JdlSurfaceVariant | 'default'): JdlSurfaceVariant =>
  variant === 'default' ? 'quiet' : variant;

const renderFieldMeta = (hint?: React.ReactNode, error?: React.ReactNode) => {
  if (!hint && !error) return null;
  return (
    <div className="mt-2 space-y-1">
      {hint ? <div className="text-xs leading-5 text-[var(--text-faint)]">{hint}</div> : null}
      {error ? <div className="text-xs font-medium leading-5 text-[var(--danger)]">{error}</div> : null}
    </div>
  );
};

export type { JdlSurfaceVariant, JdlTone } from '../../src/design/jdl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: JdlSurfaceVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'hero',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(
      'app-button inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] disabled:cursor-not-allowed disabled:opacity-55',
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      className
    )}
    {...props}
  >
    {children}
  </button>
);

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: JdlTone;
  variant?: JdlSurfaceVariant | 'default';
}> = ({ children, className, tone = 'default', variant = 'quiet' }) => (
  <div
    className={cn(
      SURFACE_VARIANTS[resolveSurfaceVariant(variant)],
      'rounded-[var(--radius-surface)] border p-4 shadow-[var(--shadow-card)] sm:p-5',
      TONE_CLASSES[tone],
      className
    )}
  >
    {children}
  </div>
);

export const SectionPanel: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  tone?: JdlTone;
  variant?: JdlSurfaceVariant | 'default';
}> = ({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  contentClassName,
  tone = 'default',
  variant = 'quiet',
}) => (
  <SurfaceCard className={cn('space-y-4', className)} tone={tone} variant={variant}>
    {title || description || eyebrow || actions ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? <div className="app-eyebrow w-fit">{eyebrow}</div> : null}
          {title ? <h2 className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-xl">{title}</h2> : null}
          {description ? <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    ) : null}
    {children ? <div className={cn('space-y-4', contentClassName)}>{children}</div> : null}
  </SurfaceCard>
);

export const Toolbar: React.FC<{
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
  variant?: Extract<JdlSurfaceVariant, 'quiet' | 'frost' | 'spotlight' | 'dock'> | 'default';
}> = ({ children, className, sticky = false, variant = 'quiet' }) => (
  <div
    className={cn(
      SURFACE_VARIANTS[resolveSurfaceVariant(variant)],
      'rounded-[var(--radius-panel)] border p-3 shadow-[var(--shadow-soft)]',
      sticky && 'lg:sticky lg:top-[calc(var(--app-toolbar-offset)+6px)] z-20',
      className
    )}
  >
    {children}
  </div>
);

export const PageHero: React.FC<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: Extract<JdlSurfaceVariant, 'quiet' | 'frost' | 'spotlight' | 'hero' | 'spatial'>;
}> = ({ eyebrow, title, body, actions, children, className, variant = 'hero' }) => (
  <SurfaceCard
    className={cn(
      'gap-5 p-5 sm:p-6 md:p-8',
      (variant === 'hero' || variant === 'spatial') && 'app-hero-spatial-grid',
      className
    )}
    variant={variant}
  >
    <div className={cn('grid gap-5', Boolean(actions) && (variant === 'hero' || variant === 'spatial') && 'xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)] xl:items-start')}>
      <div className="space-y-4">
        {eyebrow ? <div className="app-eyebrow w-fit">{eyebrow}</div> : null}
        <div className="space-y-3">
          <h1 className={cn(
            'max-w-4xl text-[2rem] font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[2.5rem] md:text-[3rem]',
            (variant === 'hero' || variant === 'spatial') && 'app-display'
          )}>
            {title}
          </h1>
          {body ? <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)] md:text-base">{body}</p> : null}
        </div>
      </div>
      {actions ? <div className={cn('flex flex-wrap items-center gap-3', (variant === 'hero' || variant === 'spatial') && 'xl:justify-end xl:pt-1')}>{actions}</div> : null}
    </div>
    {children ? <div className={cn('border-t border-[var(--border-subtle)] pt-5', (variant === 'hero' || variant === 'spatial') && 'space-y-5')}>{children}</div> : null}
  </SurfaceCard>
);

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'immersive';
}> = ({ variant = 'default', ...props }) => (
  <PageHero
    variant={variant === 'immersive' ? 'spatial' : 'quiet'}
    {...props}
  />
);

export const FilterChip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}> = ({ active = false, onClick, children, className, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    className={cn('app-filter-chip', active && 'app-filter-chip-active', className)}
  >
    {children}
  </button>
);

export const MetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  tone?: JdlTone;
  className?: string;
}> = ({ label, value, helper, tone = 'default', className }) => (
  <div
    className={cn(
      'app-data-tile min-w-0 rounded-[var(--radius-panel)] px-4 py-4',
      tone === 'default' && 'bg-[var(--surface-muted)] border-[var(--border)]',
      tone === 'muted' && 'bg-[var(--surface-soft)] border-[var(--border-soft)]',
      tone === 'accent' && 'border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(var(--accent-rgb),0.08)]',
      tone === 'success' && 'border-[rgba(var(--accent-green-rgb),0.24)] bg-[rgba(var(--accent-green-rgb),0.08)]',
      tone === 'warning' && 'border-[rgba(var(--accent-gold-rgb),0.3)] bg-[rgba(var(--accent-gold-rgb),0.12)]',
      tone === 'danger' && 'border-[rgba(var(--danger-rgb),0.22)] bg-[rgba(var(--danger-rgb),0.08)]',
      className
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{label}</div>
    <div className="app-data-value mt-2 break-words text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)] sm:text-lg">{value}</div>
    {helper ? (
      <div className="mt-1.5 text-xs leading-5 text-[var(--text-faint)]">{helper}</div>
    ) : null}
  </div>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'accent' | 'subtle' | 'teal' | 'danger';
  icon?: React.ReactNode;
  className?: string;
}> = ({ children, variant = 'default', icon, className }) => {
  const variants = {
    default: 'bg-[var(--surface-muted)] text-[var(--text)] border-[var(--border)]',
    outline: 'bg-transparent text-[var(--text)] border-[var(--border)]',
    accent: 'bg-[var(--accent)] text-white border-transparent',
    subtle: 'bg-[rgba(var(--accent-rgb),0.08)] text-[var(--accent)] border-[rgba(var(--accent-rgb),0.18)]',
    teal: 'bg-[rgba(var(--accent-sky-rgb),0.12)] text-[var(--accent-sky)] border-[rgba(var(--accent-sky-rgb),0.2)]',
    danger: 'bg-[rgba(var(--danger-rgb),0.08)] text-[var(--danger)] border-[rgba(var(--danger-rgb),0.2)]',
  };

  return (
    <div className={cn(
      'app-organic-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-colors',
      variants[variant],
      className
    )}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </div>
  );
};

export const Pill = Badge;

export const EmptyState: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, body, action, className }) => (
  <SurfaceCard className={cn('text-center', className)} tone="muted">
    <div className="mx-auto max-w-xl space-y-3 py-8">
      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{title}</h3>
      <p className="text-sm leading-7 text-[var(--text-muted)]">{body}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  </SurfaceCard>
);

interface FieldBaseProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  fieldClassName?: string;
}

export const InputField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & FieldBaseProps>(
  ({ label, hint, error, className, fieldClassName, ...props }, ref) => (
    <label className={cn('block space-y-2', className)}>
      {label ? <span className="app-field-label">{label}</span> : null}
      <input ref={ref} className={cn('app-input-base', fieldClassName)} {...props} />
      {renderFieldMeta(hint, error)}
    </label>
  )
);
InputField.displayName = 'InputField';

export const TextareaField = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBaseProps>(
  ({ label, hint, error, className, fieldClassName, ...props }, ref) => (
    <label className={cn('block space-y-2', className)}>
      {label ? <span className="app-field-label">{label}</span> : null}
      <textarea ref={ref} className={cn('app-input-base min-h-[120px] resize-y', fieldClassName)} {...props} />
      {renderFieldMeta(hint, error)}
    </label>
  )
);
TextareaField.displayName = 'TextareaField';

export const SelectField = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & FieldBaseProps>(
  ({ label, hint, error, className, fieldClassName, children, ...props }, ref) => (
    <label className={cn('block space-y-2', className)}>
      {label ? <span className="app-field-label">{label}</span> : null}
      <select ref={ref} className={cn('app-input-base', fieldClassName)} {...props}>
        {children}
      </select>
      {renderFieldMeta(hint, error)}
    </label>
  )
);
SelectField.displayName = 'SelectField';

export const ModalShell: React.FC<{
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
  maxWidthClassName?: string;
  title?: React.ReactNode;
  body?: React.ReactNode;
  kicker?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  variant?: Extract<JdlSurfaceVariant, 'quiet' | 'frost' | 'spotlight' | 'hero' | 'danger'>;
}> = ({
  children,
  className,
  panelClassName,
  maxWidthClassName = 'max-w-2xl',
  title,
  body,
  kicker,
  actions,
  onClose,
  variant = 'frost',
}) => (
  <div className={cn('app-modal-backdrop', className)}>
    <div className={cn('app-modal-panel w-full', SURFACE_VARIANTS[variant], maxWidthClassName, panelClassName)}>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-overlay)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      ) : null}
      {title || body || kicker || actions ? (
        <div className="space-y-4 border-b border-[var(--border-subtle)] px-6 py-6 sm:px-8">
          {kicker ? <div className="app-eyebrow w-fit">{kicker}</div> : null}
          {title ? <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[var(--text-strong)]">{title}</h2> : null}
          {body ? <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">{body}</p> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-6 py-6 sm:px-8">{children}</div>
    </div>
  </div>
);

export const WorkspaceShell: React.FC<{
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  hero?: React.ReactNode;
  toolbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  density?: 'comfortable' | 'compact';
}> = ({
  children,
  className,
  contentClassName,
  hero,
  toolbar,
  sidebar,
  density = 'comfortable',
}) => (
  <div className={cn('app-workspace-shell space-y-5', density === 'compact' && 'space-y-4', className)}>
    {hero}
    {toolbar}
    <div className={cn(
      'grid gap-5',
      sidebar ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : null,
      contentClassName
    )}>
      {sidebar ? <aside className="min-w-0">{sidebar}</aside> : null}
      <div className="min-w-0">{children}</div>
    </div>
  </div>
);

// Solarpunk primitives retained as subtle atmospheric motifs inside JDL.

export const SolarpunkPath: React.FC<{
  orientation?: 'vertical' | 'horizontal' | 'arc';
  className?: string;
}> = ({ orientation = 'arc', className }) => {
  const paths = {
    vertical: 'M0,0 Q2,50 0,100',
    horizontal: 'M0,0 Q50,2 100,0',
    arc: 'M0,0 Q30,30 60,0',
  };

  return (
    <svg
      className={cn('overflow-visible', className)}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ minWidth: '100%', minHeight: '100%' }}
    >
      <path
        d={paths[orientation]}
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
        opacity={0.4}
      />
    </svg>
  );
};

export const EnergyNode: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  pulse?: boolean;
  className?: string;
}> = ({ size = 'md', active = true, pulse = true, className }) => {
  const sizeMap = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  return (
    <motion.div
      className={cn(sizeMap[size], 'flex-shrink-0 rounded-full bg-[var(--accent)]', className)}
      animate={pulse ? { scale: [1, 1.18, 1], opacity: [1, 0.82, 1] } : undefined}
      transition={pulse ? JDL_MOTION.breathe : undefined}
      initial={{ opacity: active ? 1 : 0.4 }}
    />
  );
};

export const EnergyNodeRing: React.FC<{
  count: number;
  delay?: number;
  maxVisible?: number;
  className?: string;
}> = ({ count, delay = 0.1, maxVisible = 3, className }) => {
  const visibleCount = Math.min(count, maxVisible);
  const angle = (360 / visibleCount) * (Math.PI / 180);

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {Array.from({ length: visibleCount }).map((_, i) => {
        const rad = angle * i;
        const x = Math.cos(rad) * 12;
        const y = Math.sin(rad) * 12;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ ...JDL_MOTION.breathe, delay: delay * i }}
          >
            <EnergyNode size="sm" pulse={false} />
          </motion.div>
        );
      })}
      {count > maxVisible ? (
        <span className="text-[10px] font-semibold text-[var(--text-faint)]">+{count - maxVisible}</span>
      ) : null}
    </div>
  );
};

export const GrowthSignal: React.FC<{
  level: number;
  variant?: 'emoji' | 'dot';
  className?: string;
}> = ({ level, variant = 'emoji', className }) => {
  const getGrowthEmoji = (lvl: number) => {
    if (lvl === 0) return 'o';
    if (lvl < 3) return '🌱';
    if (lvl < 8) return '🌿';
    if (lvl < 16) return '🍀';
    return '🌳';
  };

  const getDotColor = (lvl: number) => {
    if (lvl === 0) return 'bg-[var(--border-subtle)]';
    if (lvl < 3) return 'bg-[rgba(var(--accent-green-rgb),0.4)]';
    if (lvl < 8) return 'bg-[rgba(var(--accent-green-rgb),0.6)]';
    if (lvl < 16) return 'bg-[rgba(var(--accent-green-rgb),0.8)]';
    return 'bg-[var(--accent-green)]';
  };

  if (variant === 'emoji') {
    return <span className={cn('text-lg', className)}>{getGrowthEmoji(level)}</span>;
  }

  return (
    <div className={cn('h-2 w-2 rounded-full transition-colors duration-300', getDotColor(level), className)} />
  );
};

export const SolarpunkProgressFlow: React.FC<{
  steps: Array<{ label: string; completed: boolean }>;
  currentStep?: number;
  className?: string;
}> = ({ steps, currentStep = 0, className }) => (
  <div className={cn('flex items-center justify-between', className)}>
    {steps.map((step, idx) => (
      <React.Fragment key={idx}>
        <motion.div
          className="flex flex-col items-center"
          animate={{ scale: idx === currentStep ? 1.08 : 1 }}
          transition={JDL_MOTION.enter}
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)]',
              step.completed
                ? 'bg-[var(--accent-green)] text-white'
                : idx === currentStep
                  ? 'border border-[var(--accent-green)] bg-[rgba(var(--accent-green-rgb),0.2)]'
                  : 'border border-[var(--border-subtle)] bg-[var(--surface-muted)]'
            )}
          >
            <span className="text-xs font-semibold">{idx + 1}</span>
          </div>
          <div className="mt-2 text-xs font-medium text-[var(--text-muted)]">{step.label}</div>
        </motion.div>

        {idx < steps.length - 1 ? (
          <div className="relative mx-3 h-0.5 flex-1">
            <div className={cn('h-full transition-all duration-[var(--motion-enter)]', step.completed ? 'bg-[var(--accent-green)]' : 'bg-[var(--border-subtle)]')} />
            {idx === currentStep ? (
              <motion.div
                className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--accent-green)]"
                animate={{ x: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            ) : null}
          </div>
        ) : null}
      </React.Fragment>
    ))}
  </div>
);

export { SolarpunkGlassHero } from './SolarpunkGlassHero';
export { CareerPathLine } from './CareerPathLine';
