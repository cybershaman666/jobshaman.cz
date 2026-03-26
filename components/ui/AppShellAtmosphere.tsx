import React from 'react';
import { cn } from './primitives';

interface AppShellAtmosphereProps {
  className?: string;
}

const AppShellAtmosphere: React.FC<AppShellAtmosphereProps> = ({ className }) => (
  <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f7fafc_52%,#f5f8fb_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#020817_52%,#030712_100%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.06),transparent_24%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.05),transparent_26%),radial-gradient(circle_at_50%_18%,rgba(245,158,11,0.04),transparent_22%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.06),transparent_24%),radial-gradient(circle_at_50%_18%,rgba(245,158,11,0.05),transparent_20%)]" />
  </div>
);

export default AppShellAtmosphere;
