export const getApplicationStatusCopy = (
  status?: string,
  t?: (key: string, opts: { defaultValue: string }) => string,
) => {
  const translate = t ?? ((_: string, opts: { defaultValue: string }) => opts.defaultValue);
  switch (status) {
    case 'reviewed':
      return { label: translate('rebuild.status.in_review', { defaultValue: 'In review' }), tone: 'bg-[#12AFCB]/10 text-[#0f95ac]' };
    case 'shortlisted':
      return { label: translate('rebuild.status.shortlisted', { defaultValue: 'Shortlisted' }), tone: 'bg-emerald-100 text-emerald-700' };
    case 'hired':
      return { label: translate('rebuild.status.offer_lane', { defaultValue: 'Offer lane' }), tone: 'bg-emerald-100 text-emerald-700' };
    case 'rejected':
    case 'closed_rejected':
      return { label: translate('rebuild.status.closed', { defaultValue: 'Closed' }), tone: 'bg-rose-100 text-rose-700' };
    case 'withdrawn':
    case 'closed_withdrawn':
      return { label: translate('rebuild.status.withdrawn', { defaultValue: 'Withdrawn' }), tone: 'bg-slate-100 text-slate-500' };
    case 'closed_role_filled':
      return { label: translate('rebuild.status.role_filled', { defaultValue: 'Role filled' }), tone: 'bg-slate-100 text-slate-500' };
    case 'pending':
    default:
      return { label: translate('rebuild.status.submitted', { defaultValue: 'Submitted' }), tone: 'bg-amber-100 text-amber-700' };
  }
};
