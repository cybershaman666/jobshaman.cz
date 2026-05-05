import { Suspense } from 'react';
import JobshamanRebuildApp from './rebuild/JobshamanRebuildApp';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-slate-950 text-[#12AFCB]"><div className="h-12 w-12 animate-spin rounded-full border-2 border-current border-t-transparent" /></div>}>
        <JobshamanRebuildApp />
      </Suspense>
    </AuthProvider>
  );
}
