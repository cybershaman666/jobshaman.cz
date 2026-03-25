import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Bell, HelpCircle, Briefcase, CheckCircle2,
  User, BrainCircuit, Hexagon, UserPlus, TrendingUp,
  Layers, Users, BarChart3, X, ChevronUp, BookOpen
} from 'lucide-react';

const CyberBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none bg-slate-50 overflow-hidden">
    {/* Abstract Neural Network Background */}
    
    {/* Soft glowing orbs for depth */}
    <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
    <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
    <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] bg-orange-400/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />

    {/* Abstract geometric grid/connections */}
    <div className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(to right, #0f172a 1px, transparent 1px),
          linear-gradient(to bottom, #0f172a 1px, transparent 1px)
        `,
        backgroundSize: '4rem 4rem',
        maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)'
      }}
    />

    {/* Floating abstract neural pathways */}
    <div className="absolute inset-0 flex items-center justify-center opacity-20">
      <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform="translate(500, 500)" filter="url(#soft-glow)">
          {/* Concentric abstract rings representing thought expansion */}
          <circle cx="0" cy="0" r="150" fill="none" stroke="#10b981" strokeWidth="0.5" strokeDasharray="4 12" className="animate-[spin_60s_linear_infinite]" />
          <circle cx="0" cy="0" r="280" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="8 24" className="animate-[spin_90s_linear_infinite_reverse]" />
          <circle cx="0" cy="0" r="450" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="12 36" className="animate-[spin_120s_linear_infinite]" />
          
          {/* Abstract connecting lines representing synapses */}
          <path d="M -150 0 Q -200 -100 -280 -50 T -450 -100" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
          <path d="M 100 110 Q 200 150 250 200 T 400 300" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
          <path d="M -50 -140 Q -100 -250 0 -350 T -100 -450" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
          <path d="M 120 -90 Q 250 -100 300 -200 T 420 -150" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
          <path d="M -100 110 Q -150 250 -250 200 T -350 350" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    </div>
  </div>
);

const nodes = [
  { id: 1, title: 'Front Desk Manager', subtitle: 'Hospitality\nDirect Promotion', tags: ['Leadership', 'Hospitality'], image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=200&h=200&fit=crop', angle: -145, distance: 300, textPos: 'left', dir: 'out', color: 'orange', description: 'Manage the reception area, supervise staff, and ensure exceptional guest experiences.', skills: ['Team Leadership', 'Shift Scheduling', 'Guest Relations'], mentor: { name: 'Sarah Jenkins', role: 'Hotel General Manager', image: 'https://i.pravatar.cc/150?img=44' } },
  { id: 2, title: 'Customer Support', subtitle: 'Tech / IT\nLateral Move', tags: ['Tech', 'Communication'], image: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?q=80&w=200&h=200&fit=crop', angle: 180, distance: 260, textPos: 'left', dir: 'out', color: 'green', description: 'Provide technical assistance and support to users via phone, email, or chat.', skills: ['Ticketing Systems', 'Troubleshooting', 'Empathy'], mentor: { name: 'David Lee', role: 'Support Lead', image: 'https://i.pravatar.cc/150?img=33' } },
  { id: 3, title: 'Office Manager', subtitle: 'Corporate\nLateral Move', tags: ['Admin', 'Operations'], image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=200&h=200&fit=crop', angle: 145, distance: 300, textPos: 'left', dir: 'out', color: 'green', description: 'Oversee daily office operations, manage supplies, and support administrative staff.', skills: ['Administration', 'Vendor Management', 'Organization'], mentor: { name: 'Emily Chen', role: 'Operations Director', image: 'https://i.pravatar.cc/150?img=22' } },
  { id: 4, title: 'Customer Success', subtitle: 'SaaS / Software\nCareer Pivot', tags: ['SaaS', 'Client Retention'], image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=200&h=200&fit=crop', angle: 90, distance: 240, textPos: 'right', dir: 'out', color: 'orange', description: 'Work proactively with customers to ensure they achieve their desired outcomes using the product.', skills: ['Account Management', 'Churn Reduction', 'Onboarding'], mentor: { name: 'Michael Brown', role: 'VP of Customer Success', image: 'https://i.pravatar.cc/150?img=11' } },
  { id: 5, title: 'Event Coordinator', subtitle: 'Events & Hospitality\nSpecialization', tags: ['Events', 'Planning'], image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=200&h=200&fit=crop', angle: 30, distance: 320, textPos: 'right', dir: 'out', color: 'green', description: 'Plan, organize, and execute events, conferences, and banquets.', skills: ['Event Planning', 'Budgeting', 'Coordination'], mentor: { name: 'Jessica Taylor', role: 'Senior Event Manager', image: 'https://i.pravatar.cc/150?img=55' } },
  { id: 6, title: 'Reservations Manager', subtitle: 'Hospitality\nSpecialization', tags: ['Revenue', 'Hospitality'], image: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?q=80&w=200&h=200&fit=crop', angle: -15, distance: 280, textPos: 'right', dir: 'out', color: 'orange', shape: 'hexagon', description: 'Manage room inventory, optimize pricing strategies, and oversee the reservations team.', skills: ['Revenue Management', 'Booking Software', 'Data Analysis'], mentor: { name: 'Robert Wilson', role: 'Director of Revenue', image: 'https://i.pravatar.cc/150?img=66' } },
  { id: 7, title: 'HR Assistant', subtitle: 'Human Resources\nCareer Pivot', tags: ['HR', 'People'], image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=200&h=200&fit=crop', angle: -60, distance: 340, textPos: 'right', dir: 'out', color: 'green', description: 'Support HR operations including recruitment, onboarding, and employee relations.', skills: ['Recruitment', 'Employee Relations', 'HRIS'], mentor: { name: 'Amanda White', role: 'HR Business Partner', image: 'https://i.pravatar.cc/150?img=47' } },
  { id: 8, title: 'Recruitment Coordinator', subtitle: 'Human Resources\nSpecialization', tags: ['HR', 'Recruitment'], image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&h=200&fit=crop', angle: -50, distance: 360, textPos: 'right', dir: 'out', color: 'green', description: 'Coordinate interviews, manage job postings, and assist with candidate sourcing.', skills: ['Interviewing', 'ATS', 'Sourcing'], mentor: { name: 'Amanda White', role: 'HR Business Partner', image: 'https://i.pravatar.cc/150?img=47' } },
  { id: 9, title: 'Training Specialist', subtitle: 'Human Resources\nSpecialization', tags: ['HR', 'Training'], image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=200&h=200&fit=crop', angle: -70, distance: 320, textPos: 'right', dir: 'out', color: 'green', description: 'Develop and deliver training programs for employees.', skills: ['Instructional Design', 'Public Speaking', 'Coaching'], mentor: { name: 'Amanda White', role: 'HR Business Partner', image: 'https://i.pravatar.cc/150?img=47' } },
  { id: 10, title: 'Sales Representative', subtitle: 'Sales\nCareer Pivot', tags: ['Sales', 'B2B'], image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?q=80&w=200&h=200&fit=crop', angle: 100, distance: 260, textPos: 'right', dir: 'out', color: 'orange', description: 'Identify leads, pitch products, and close sales deals.', skills: ['Negotiation', 'CRM', 'Cold Calling'], mentor: { name: 'Michael Brown', role: 'VP of Sales', image: 'https://i.pravatar.cc/150?img=11' } },
  { id: 11, title: 'Account Executive', subtitle: 'Sales\nPromotion', tags: ['Sales', 'Account Management'], image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&h=200&fit=crop', angle: 80, distance: 280, textPos: 'right', dir: 'out', color: 'orange', description: 'Manage client relationships and drive revenue growth.', skills: ['Relationship Building', 'Sales Strategy', 'Presentations'], mentor: { name: 'Michael Brown', role: 'VP of Sales', image: 'https://i.pravatar.cc/150?img=11' } },
  { id: 12, title: 'IT Helpdesk', subtitle: 'Tech / IT\nEntry Level', tags: ['Tech', 'Support'], image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=200&h=200&fit=crop', angle: 170, distance: 280, textPos: 'left', dir: 'out', color: 'green', description: 'First point of contact for IT issues and requests.', skills: ['Hardware Troubleshooting', 'Software Installation', 'Customer Service'], mentor: { name: 'David Lee', role: 'Support Lead', image: 'https://i.pravatar.cc/150?img=33' } },
  { id: 13, title: 'System Administrator', subtitle: 'Tech / IT\nPromotion', tags: ['Tech', 'Infrastructure'], image: 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?q=80&w=200&h=200&fit=crop', angle: 190, distance: 300, textPos: 'left', dir: 'out', color: 'green', description: 'Maintain and configure IT systems and networks.', skills: ['Linux/Windows Server', 'Networking', 'Security'], mentor: { name: 'David Lee', role: 'Support Lead', image: 'https://i.pravatar.cc/150?img=33' } },
];

function Navbar() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "New Job Match", message: "A new Front Desk Manager role opened at Grand Plaza.", time: "2h ago", unread: true },
    { id: 2, title: "Course Recommendation", message: "Based on your interest in Tech Support, try 'Zendesk Mastery'.", time: "5h ago", unread: true },
    { id: 3, title: "Profile View", message: "A recruiter from CyberDyne viewed your profile.", time: "1d ago", unread: false },
  ]);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <nav className="h-20 px-8 flex items-center justify-between relative z-50 border-b border-slate-200/50 bg-white/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-45 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
           <div className="w-4 h-4 bg-white rounded-sm -rotate-45"></div>
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">CyberShaman OS</span>
      </div>

      <div className="flex-1 max-w-2xl mx-8 relative">
        <div className={`relative flex items-center w-full h-12 rounded-full bg-white/80 backdrop-blur-md border ${isSearchFocused ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-200'} px-4 transition-all z-50`}>
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search the neural network..."
            className="w-full bg-transparent border-none outline-none px-3 text-slate-700 placeholder:text-slate-400"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={(e) => {
              // Only close if clicking outside the search container entirely
              if (!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget as Node)) {
                 setIsSearchFocused(false);
              }
            }}
          />
        </div>

        {/* Search Filters Dropdown */}
        {isSearchFocused && (
          <div 
            className="absolute top-14 left-0 w-full bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl p-6 z-40 animate-in fade-in slide-in-from-top-4 duration-200"
            tabIndex={-1} // Make it focusable to keep search open
          >
            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4">Advanced Filters</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">City / Location</label>
                  <input type="text" placeholder="e.g. Prague, London..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Job Title</label>
                  <input type="text" placeholder="e.g. Front Desk Manager" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1 flex justify-between">
                    <span>Commute Distance</span>
                    <span className="text-emerald-600">25 km</span>
                  </label>
                  <input type="range" min="0" max="100" defaultValue="25" className="w-full accent-emerald-500" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50 bg-white" />
                  <span className="text-sm text-slate-600">Remote Work</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50 bg-white" />
                  <span className="text-sm text-slate-600">Dog-friendly Office</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50 bg-white" />
                  <span className="text-sm text-slate-600">Company Car (Private Use)</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/50 bg-white" />
                  <span className="text-sm text-slate-600">Flexible Hours</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
        <a href="#" className="hover:text-emerald-600 transition-colors">Network</a>
        <a href="#" className="hover:text-emerald-600 transition-colors">Nodes</a>
        <a href="#" className="hover:text-emerald-600 transition-colors">Uplink</a>
        <div className="flex items-center gap-4 ml-4">
          <div className="relative">
            <button 
              className="relative p-2 hover:bg-slate-100 rounded-full transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => n.unread) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border border-white"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800">Notifications</h3>
                  <button onClick={markAllAsRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Mark all as read</button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${n.unread ? 'bg-emerald-50/30' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm ${n.unread ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>{n.title}</h4>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center border-t border-slate-100 bg-slate-50/50">
                  <button className="text-xs font-medium text-slate-500 hover:text-slate-700">View All Activity</button>
                </div>
              </div>
            )}
          </div>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm ml-2">
            <img src="https://i.pravatar.cc/150?img=11" alt="User avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
      </div>
    </nav>
  );
}

function Sidebar({ activeCategory, activeLayer, onNavigate }: { activeCategory?: any, activeLayer: string, onNavigate: (layer: string) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`transition-all duration-300 ease-in-out pl-8 py-8 flex flex-col z-20 ${isCollapsed ? 'w-24' : 'w-72'}`}>
      <div className="bg-white/60 backdrop-blur-md border border-slate-200/50 rounded-2xl p-4 flex flex-col gap-2 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 mb-2">
          {!isCollapsed && <h3 className="font-semibold text-slate-800 whitespace-nowrap">Reality Filter</h3>}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`text-slate-400 hover:text-slate-600 transition-transform duration-300 ${isCollapsed ? 'rotate-90 mx-auto' : '-rotate-90'}`}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={() => onNavigate('career_path')}
          className={`flex items-center gap-3 py-3 rounded-xl font-medium transition-all ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${activeLayer === 'career_path' || activeLayer === 'job_offers' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'hover:bg-white/50 text-slate-500 border border-transparent'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeLayer === 'career_path' || activeLayer === 'job_offers' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
            <TrendingUp className="w-4 h-4" />
          </div>
          {!isCollapsed && <span className="whitespace-nowrap">Career Path</span>}
        </button>

        <button 
          onClick={() => onNavigate('skills_gap')}
          className={`flex items-center gap-3 py-3 rounded-xl font-medium transition-all ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${activeLayer === 'skills_gap' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'hover:bg-white/50 text-slate-500 border border-transparent'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeLayer === 'skills_gap' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
            <Layers className="w-4 h-4" />
          </div>
          {!isCollapsed && <span className="whitespace-nowrap">Skills Gap</span>}
        </button>

        <button 
          onClick={() => onNavigate('mentor_network')}
          className={`flex items-center gap-3 py-3 rounded-xl font-medium transition-all ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${activeLayer === 'mentor_network' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'hover:bg-white/50 text-slate-500 border border-transparent'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeLayer === 'mentor_network' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
            <User className="w-4 h-4" />
          </div>
          {!isCollapsed && <span className="whitespace-nowrap">Mentor Network</span>}
        </button>

        <button 
          onClick={() => onNavigate('market_trends')}
          className={`flex items-center gap-3 py-3 rounded-xl font-medium transition-all ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${activeLayer === 'market_trends' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'hover:bg-white/50 text-slate-500 border border-transparent'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeLayer === 'market_trends' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
            <BarChart3 className="w-4 h-4" />
          </div>
          {!isCollapsed && <span className="whitespace-nowrap">Market Trends</span>}
        </button>
      </div>
    </aside>
  );
}

function CareerMap({ onNodeClick }: { onNodeClick: (node: any) => void }) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  // Clustering logic
  const CLUSTER_THRESHOLD = 120; // Distance threshold for clustering
  
  // Calculate x, y for each node
  const nodesWithPositions = nodes.map(node => {
    const rad = (node.angle * Math.PI) / 180;
    const x = Math.cos(rad) * node.distance;
    const y = Math.sin(rad) * node.distance;
    return { ...node, x, y };
  });

  const clusters: any[] = [];
  
  nodesWithPositions.forEach(node => {
    let foundCluster = false;
    for (const cluster of clusters) {
      const dx = cluster.x - node.x;
      const dy = cluster.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < CLUSTER_THRESHOLD) {
        cluster.nodes.push(node);
        // Update cluster center to average
        cluster.x = cluster.nodes.reduce((sum: number, n: any) => sum + n.x, 0) / cluster.nodes.length;
        cluster.y = cluster.nodes.reduce((sum: number, n: any) => sum + n.y, 0) / cluster.nodes.length;
        foundCluster = true;
        break;
      }
    }
    
    if (!foundCluster) {
      clusters.push({
        id: `cluster-${node.id}`,
        x: node.x,
        y: node.y,
        nodes: [node]
      });
    }
  });

  const handleClusterClick = (clusterId: string) => {
    setExpandedClusters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
      }
      return newSet;
    });
  };

  const renderItems: any[] = [];
  
  clusters.forEach(cluster => {
    if (cluster.nodes.length === 1) {
      // Single node, just render it
      renderItems.push({ 
        type: 'node', 
        data: cluster.nodes[0],
        key: `node-${cluster.nodes[0].id}`,
        targetX: cluster.nodes[0].x,
        targetY: cluster.nodes[0].y,
        startX: cluster.nodes[0].x,
        startY: cluster.nodes[0].y
      });
    } else {
      const isExpanded = expandedClusters.has(cluster.id);
      
      if (!isExpanded) {
        // Collapsed cluster
        renderItems.push({ 
          type: 'cluster', 
          data: cluster,
          key: `cluster-${cluster.id}`,
          targetX: cluster.x,
          targetY: cluster.y,
          startX: cluster.x,
          startY: cluster.y
        });
      } else {
        // Expanded cluster, render its children
        const numNodes = cluster.nodes.length;
        const radius = 100; // Spread radius
        
        // Render a background for the cluster area FIRST so it's behind the nodes
        renderItems.push({ 
          type: 'cluster-bg', 
          data: cluster,
          key: `cluster-bg-${cluster.id}`,
          targetX: cluster.x,
          targetY: cluster.y,
          startX: cluster.x,
          startY: cluster.y
        });

        cluster.nodes.forEach((node: any, index: number) => {
          // Calculate new position around cluster center
          const angle = (index / numNodes) * Math.PI * 2;
          const spreadX = cluster.x + Math.cos(angle) * radius;
          const spreadY = cluster.y + Math.sin(angle) * radius;
          
          // Determine text position based on angle
          const textPos = (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? 'left' : 'right';
          
          renderItems.push({ 
            type: 'node', 
            data: { ...node, x: spreadX, y: spreadY, textPos }, 
            isClustered: true, 
            clusterId: cluster.id,
            key: `node-${node.id}`,
            targetX: spreadX,
            targetY: spreadY,
            startX: cluster.x,
            startY: cluster.y,
            index
          });
        });
      }
    }
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 fade-in overflow-hidden">
      <style>
        {`
          @keyframes dash-flow {
            from { stroke-dashoffset: 100; }
            to { stroke-dashoffset: 0; }
          }
          .animate-dash-line {
            animation: dash-flow 2s linear infinite;
          }
        `}
      </style>
      <h2 className="absolute top-10 text-lg font-medium text-slate-500 tracking-widest uppercase z-20 pointer-events-none">Neural Career Map</h2>

      <motion.div 
        drag
        dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        {/* Background concentric circles */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <div className="w-[400px] h-[400px] rounded-full border border-emerald-500/20 border-dashed animate-[spin_60s_linear_infinite]"></div>
          <div className="absolute w-[600px] h-[600px] rounded-full border border-emerald-500/10 animate-[spin_90s_linear_infinite_reverse]"></div>
          <div className="absolute w-[800px] h-[800px] rounded-full border border-emerald-500/5 border-dashed animate-[spin_120s_linear_infinite]"></div>
        </div>

        {/* SVG Lines */}
        <svg className="absolute top-1/2 left-1/2 overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="grad-orange-out" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="grad-green-out" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <AnimatePresence>
            {renderItems.map(item => {
              if (item.type === 'cluster-bg') return null;
              
              let color, isNode;
              if (item.type === 'node') {
                color = item.data.color === 'orange' ? '#f59e0b' : '#10b981';
                isNode = true;
              } else if (item.type === 'cluster') {
                color = '#3b82f6'; // Blue for clusters
                isNode = false;
              }

              // Calculate start and end points
              const dist = Math.sqrt(item.targetX * item.targetX + item.targetY * item.targetY);
              const dx = item.targetX / dist;
              const dy = item.targetY / dist;
              
              const centerR = 60;
              const nodeR = isNode ? 40 : 50;

              let startX = dx * centerR;
              let startY = dy * centerR;
              let endX = dx * (dist - nodeR);
              let endY = dy * (dist - nodeR);

              if (item.type === 'node' && item.data.dir === 'in') {
                const tempX = startX; startX = endX; endX = tempX;
                const tempY = startY; startY = endY; endY = tempY;
              }

              // For animation, we need the start position of the line when it's exiting or entering
              const startDist = Math.sqrt(item.startX * item.startX + item.startY * item.startY);
              const startDx = item.startX / startDist;
              const startDy = item.startY / startDist;
              const initialEndX = startDx * (startDist - nodeR);
              const initialEndY = startDy * (startDist - nodeR);
              
              const delay = item.isClustered ? item.index * 0.08 : 0;

              return (
                <motion.g 
                  key={`line-group-${item.key}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  {/* Base line */}
                  <motion.line
                    initial={{ x2: initialEndX, y2: initialEndY }}
                    animate={{ x2: endX, y2: endY }}
                    exit={{ x2: initialEndX, y2: initialEndY }}
                    transition={{ type: "spring", stiffness: 250, damping: 20, delay }}
                    x1={startX} y1={startY}
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.3"
                  />
                  {/* Animated dashed line for neural flow */}
                  <motion.line
                    initial={{ x2: initialEndX, y2: initialEndY }}
                    animate={{ x2: endX, y2: endY }}
                    exit={{ x2: initialEndX, y2: initialEndY }}
                    transition={{ type: "spring", stiffness: 250, damping: 20, delay }}
                    x1={startX} y1={startY}
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="8 8"
                    className="animate-dash-line"
                    filter="url(#glow-line)"
                    opacity="0.8"
                  />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Nodes */}
        <div className="relative w-full h-full flex items-center justify-center z-10">
          {/* Center Node */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
            onClick={() => onNodeClick({
              id: 'current-role',
              title: 'Hotel Receptionist',
              subtitle: 'Current Role',
              tags: ['Hospitality', 'Customer Service'],
              image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=200&h=200&fit=crop',
              description: 'Manage the front desk, assist guests with check-in/check-out, and ensure a smooth hotel experience.',
              skills: ['Customer Service', 'Booking Systems', 'Communication'],
              mentor: null
            })}
          >
            <div className="w-[120px] h-[120px] rounded-full bg-white shadow-[inset_0_0_20px_rgba(16,185,129,0.1),0_10px_40px_rgba(16,185,129,0.2)] border border-emerald-500/30 flex items-center justify-center backdrop-blur-xl relative transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-500 group-hover:shadow-[inset_0_0_30px_rgba(16,185,129,0.2),0_10px_50px_rgba(16,185,129,0.3)]">
               <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-emerald-500/10 to-orange-500/10 blur-md transition-opacity duration-300 group-hover:opacity-100 opacity-60 z-0 animate-pulse"></div>
               <img src="https://i.pravatar.cc/150?img=68" alt="Profile" className="w-[104px] h-[104px] rounded-full object-cover relative z-10 border-2 border-white shadow-md transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
            </div>
            <div className="mt-3 px-5 py-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg text-center border border-slate-200 transition-colors duration-300 group-hover:border-emerald-500/30">
              <div className="text-[15px] font-bold text-slate-800">Alex Johnson</div>
              <div className="text-[13px] font-medium text-emerald-600">Hotel Receptionist</div>
            </div>
          </div>

          {/* Outer Nodes & Clusters */}
          <AnimatePresence>
            {renderItems.map(item => {
              if (item.type === 'cluster-bg') {
                return (
                  <motion.div
                    key={item.key}
                    initial={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: 0, opacity: 0 }}
                    animate={{ x: `calc(-50% + ${item.targetX}px)`, y: `calc(-50% + ${item.targetY}px)`, scale: 1, opacity: 1 }}
                    exit={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-1/2 left-1/2 w-[280px] h-[280px] rounded-full bg-slate-100/50 border border-slate-200/50 backdrop-blur-sm pointer-events-none z-0"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Cluster Expanded
                    </div>
                    <button 
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 pointer-events-auto shadow-sm transition-colors flex items-center gap-1 z-20"
                      onClick={(e) => { e.stopPropagation(); handleClusterClick(item.data.id); }}
                    >
                      <X className="w-3 h-3" /> Collapse
                    </button>
                  </motion.div>
                );
              }

              if (item.type === 'cluster') {
                const cluster = item.data;
                const category = cluster.nodes[0]?.tags[0] || 'Path';
                return (
                  <motion.div
                    key={item.key}
                    initial={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: 0, opacity: 0 }}
                    animate={{ x: `calc(-50% + ${item.targetX}px)`, y: `calc(-50% + ${item.targetY}px)`, scale: 1, opacity: 1 }}
                    exit={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-1/2 left-1/2 flex items-center justify-center z-10"
                  >
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleClusterClick(cluster.id); }} 
                      className="w-[100px] h-[100px] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md border-2 border-blue-400 rounded-full cursor-pointer transition-all duration-300 hover:scale-110 hover:border-blue-500 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] group"
                    >
                      <div className="absolute inset-1 rounded-full blur-md opacity-20 bg-blue-500 group-hover:opacity-40 transition-opacity duration-300"></div>
                      <Layers className="w-6 h-6 text-blue-500 relative z-10 mb-1" />
                      <span className="text-[11px] font-bold text-slate-700 relative z-10 text-center leading-tight px-2">
                        {category}<br/>
                        <span className="text-blue-600 font-medium">{cluster.nodes.length} directions</span>
                      </span>
                    </div>
                  </motion.div>
                );
              }

              // Render normal node
              const node = item.data;
              const delay = item.isClustered ? item.index * 0.08 : 0;
              
              return (
                <motion.div
                  key={item.key}
                  initial={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: item.isClustered ? 0.2 : 1, opacity: item.isClustered ? 0 : 1 }}
                  animate={{ x: `calc(-50% + ${item.targetX}px)`, y: `calc(-50% + ${item.targetY}px)`, scale: 1, opacity: 1 }}
                  exit={{ x: `calc(-50% + ${item.startX}px)`, y: `calc(-50% + ${item.startY}px)`, scale: item.isClustered ? 0.2 : 1, opacity: item.isClustered ? 0 : 1 }}
                  transition={{ type: "spring", stiffness: 250, damping: 20, delay }}
                  className="absolute top-1/2 left-1/2 flex items-center z-10"
                >
                  {/* Text Container Left */}
                  {node.textPos === 'left' && (
                    <div className="absolute right-full mr-4 w-max text-right flex flex-col items-end">
                      <h3 className="text-[15px] font-semibold text-slate-800">{node.title}</h3>
                      <p className="text-[13px] text-slate-500 whitespace-pre-line leading-tight mt-0.5">{node.subtitle}</p>
                      <div className="flex gap-2 mt-2">
                        {node.tags.map((tag: string) => (
                          <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag === 'AI' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Image Container */}
                  <div onClick={(e) => { e.stopPropagation(); onNodeClick(node); }} className={`w-[72px] h-[72px] flex items-center justify-center bg-white/80 backdrop-blur-md border border-slate-200 relative group cursor-pointer transition-all duration-300 hover:scale-110 ${node.color === 'orange' ? 'hover:border-orange-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]'} ${node.shape === 'hexagon' ? 'clip-hexagon' : 'rounded-full'}`}>
                     {/* Inner glow */}
                     <div className={`absolute inset-1 rounded-full blur-md opacity-20 ${node.color === 'orange' ? 'bg-orange-500' : 'bg-emerald-500'} group-hover:opacity-40 transition-opacity duration-300`}></div>
                     <img src={node.image} alt={node.title} className={`w-[56px] h-[56px] object-cover relative z-10 border border-white shadow-sm group-hover:scale-110 transition-transform duration-300 ${node.shape === 'hexagon' ? 'clip-hexagon' : 'rounded-full'}`} referrerPolicy="no-referrer" />
                  </div>

                  {/* Text Container Right */}
                  {node.textPos === 'right' && (
                    <div className="absolute left-full ml-4 w-max text-left flex flex-col items-start">
                      <h3 className="text-[15px] font-semibold text-slate-800">{node.title}</h3>
                      <p className="text-[13px] text-slate-500 whitespace-pre-line leading-tight mt-0.5">{node.subtitle}</p>
                      <div className="flex gap-2 mt-2">
                        {node.tags.map((tag: string) => (
                          <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag === 'AI' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function JobOffersMap({ category, onBack, onOfferClick }: { category: any, onBack: () => void, onOfferClick: (offer: any) => void }) {
  const isHospitality = category.tags?.includes('Hospitality') || category.title.includes('Hotel') || category.title.includes('Receptionist');
  const companyNames = isHospitality 
    ? ['Grand Plaza Hotel', 'Riverside Resort', 'The Continental', 'Azure Boutique', 'Royal Gardens', 'Horizon Suites']
    : ['TechNova', 'CyberDyne', 'GlobalNet', 'Nexus Corp', 'Stark Industries', 'Wayne Ent'];

  // Generate mock offers
  const offers = Array.from({ length: 6 }).map((_, i) => ({
    id: `offer-${category.id}-${i}`,
    title: `${category.title}`,
    company: companyNames[i],
    location: 'Prague, CZ',
    salary: `${60 + i * 10}k - ${80 + i * 10}k CZK`,
    tags: i % 2 === 0 ? ['Remote', 'Flexible Hours'] : ['On-site', 'Dog-friendly'],
    angle: (360 / 6) * i,
    distance: 220 + (i % 2) * 60,
    description: `We are looking for an experienced ${category.title} to join our innovative team at ${companyNames[i]}. You will be responsible for key operations and driving success in a fast-paced environment.`,
    skills: category.skills,
    mentor: category.mentor,
    image: category.image,
    isOffer: true,
  }));

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 fade-in overflow-hidden">
      <button 
        onClick={onBack}
        className="absolute top-10 left-10 flex items-center gap-2 px-5 py-2.5 bg-white/80 hover:bg-white text-emerald-600 rounded-full border border-emerald-200 transition-all backdrop-blur-md z-50 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:-translate-x-1"
      >
        <ChevronUp className="w-5 h-5 -rotate-90" />
        <span className="font-semibold tracking-wide text-sm">Return to Neural Map</span>
      </button>

      <h2 className="absolute top-10 text-lg font-medium text-emerald-600 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] z-20 pointer-events-none">
        Active Opportunities: {category.title}
      </h2>

      <motion.div 
        drag
        dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        {/* Background concentric circles for Offers layer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[300px] h-[300px] rounded-full border border-blue-500/30 border-dashed animate-[spin_40s_linear_infinite]"></div>
          <div className="absolute w-[500px] h-[500px] rounded-full border border-blue-500/10 animate-[spin_60s_linear_infinite_reverse]"></div>
        </div>

        {/* SVG Lines */}
        <svg className="absolute top-1/2 left-1/2 overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <filter id="glow-line-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {offers.map(offer => {
            const rad = (offer.angle * Math.PI) / 180;
            const dx = Math.cos(rad);
            const dy = Math.sin(rad);
            const centerR = 70;
            const nodeR = 35;

            const startX = dx * centerR;
            const startY = dy * centerR;
            const endX = dx * (offer.distance - nodeR);
            const endY = dy * (offer.distance - nodeR);

            return (
              <g key={`line-${offer.id}`}>
                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#3b82f6" strokeWidth="1" opacity="0.2" />
                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#60a5fa" strokeWidth="2" strokeDasharray="6 6" className="animate-dash-line" filter="url(#glow-line-blue)" opacity="0.7" />
              </g>
            );
          })}
        </svg>

        {/* Center Node (The Category) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <div className="w-[140px] h-[140px] rounded-full bg-white shadow-[inset_0_0_30px_rgba(16,185,129,0.1),0_0_50px_rgba(16,185,129,0.2)] border-2 border-emerald-400 flex items-center justify-center backdrop-blur-xl relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping opacity-50"></div>
            <img src={category.image} alt={category.title} className={`w-[120px] h-[120px] object-cover relative z-10 border-2 border-white shadow-sm ${category.shape === 'hexagon' ? 'clip-hexagon' : 'rounded-full'}`} referrerPolicy="no-referrer" />
          </div>
          <div className="mt-4 px-6 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)] border border-emerald-200">
            <div className="text-[16px] font-bold text-emerald-600">{category.title}</div>
          </div>
        </div>

        {/* Offer Nodes */}
        {offers.map(offer => {
          const rad = (offer.angle * Math.PI) / 180;
          const x = Math.cos(rad) * offer.distance;
          const y = Math.sin(rad) * offer.distance;

          return (
            <div
              key={offer.id}
              className="absolute top-1/2 left-1/2 flex flex-col items-center cursor-pointer group z-10 animate-in fade-in zoom-in duration-300"
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              onClick={() => onOfferClick(offer)}
            >
              <div className="w-[70px] h-[70px] rounded-full bg-white/80 backdrop-blur-md border border-blue-200 flex items-center justify-center group-hover:scale-110 group-hover:border-blue-400 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.2)] relative">
                <div className="absolute inset-1 rounded-full bg-blue-500/10 blur-sm group-hover:bg-blue-400/20 transition-colors"></div>
                <Briefcase className="w-7 h-7 text-blue-500 relative z-10 group-hover:text-blue-600" />
              </div>
              <div className="mt-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 text-center group-hover:border-blue-300 transition-colors shadow-sm">
                <div className="text-[14px] font-bold text-slate-800">{offer.company}</div>
                <div className="text-[12px] font-medium text-blue-600 mt-0.5">{offer.salary}</div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

function CookieBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/80 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-6 shadow-lg border border-slate-200">
        <p className="text-sm text-slate-600">
          Neural link established. See our <a href="#" className="underline font-medium text-emerald-600">data policy</a>.
        </p>
        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
          <button onClick={() => setIsVisible(false)} className="text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors">
            Accept
          </button>
          <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({ node, onClose }: { node: any, onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${node ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${node ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {node && (
          <>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">{node.isOffer ? 'Opportunity Details' : 'Role Details'}</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-8">
              {/* Header */}
              <div className="flex items-center gap-4">
                {node.isOffer ? (
                  <div className="w-16 h-16 rounded-2xl bg-white border border-blue-200 flex items-center justify-center shadow-sm">
                    <Briefcase className="w-8 h-8 text-blue-500" />
                  </div>
                ) : (
                  <img src={node.image} alt={node.title} className={`w-16 h-16 object-cover shadow-sm border border-slate-200 ${node.shape === 'hexagon' ? 'clip-hexagon' : 'rounded-2xl'}`} referrerPolicy="no-referrer" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">{node.isOffer ? node.company : node.title}</h3>
                  <p className={`text-sm font-medium mt-1 ${node.isOffer ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {node.isOffer ? node.title : node.subtitle.split('\n')[0]}
                  </p>
                </div>
              </div>

              {/* Offer Specific Details */}
              {node.isOffer && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">Location</div>
                    <div className="text-sm font-semibold text-slate-800">{node.location}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">Salary Range</div>
                    <div className="text-sm font-semibold text-emerald-600">{node.salary}</div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {node.tags && (
                <div className="flex flex-wrap gap-2">
                  {node.tags.map((tag: string) => (
                    <span key={tag} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${node.isOffer ? 'bg-blue-50 text-blue-600 border-blue-200' : tag === 'AI' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Briefcase className={`w-4 h-4 ${node.isOffer ? 'text-blue-500' : 'text-emerald-500'}`}/> {node.isOffer ? 'Job Description' : 'Role Description'}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{node.description}</p>
              </div>

              {/* Skills */}
              {node.skills && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><BookOpen className={`w-4 h-4 ${node.isOffer ? 'text-blue-500' : 'text-emerald-500'}`}/> Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {node.skills.map((skill: string) => (
                      <span key={skill} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${node.isOffer ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentor */}
              {node.mentor && !node.isOffer && (
                <div className="bg-gradient-to-br from-emerald-50 to-orange-50 p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-orange-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2 relative z-10"><User className="w-4 h-4 text-orange-500"/> Mentor Details</h4>
                  <div className="flex items-center gap-3 relative z-10">
                    <img src={node.mentor.image} alt={node.mentor.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{node.mentor.name}</p>
                      <p className="text-xs font-medium text-slate-500">{node.mentor.role}</p>
                    </div>
                  </div>
                  <button className="mt-4 w-full py-2.5 bg-white text-emerald-600 text-sm font-semibold rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors relative z-10">Connect with Mentor</button>
                </div>
              )}

              {/* Apply Button for Offers */}
              {node.isOffer && (
                <div className="mt-auto pt-4">
                  <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:-translate-y-0.5">
                    Apply for Position
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SkillsGapView({ category }: { category: any }) {
  const targetRole = category && category.id !== 'current-role' ? category : { title: 'Next Career Step', skills: ['Leadership', 'Advanced Tech', 'Strategy'] };
  
  let courses = [];
  if (!category || category.id === 'current-role') {
    courses = [
      { title: 'IT Support Fundamentals', gap: 'Missing for Tech Support', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100', duration: '4 weeks', match: '95%' },
      { title: 'Zendesk & CRM Mastery', gap: 'Required for SaaS roles', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-100', duration: '2 weeks', match: '88%' },
      { title: 'Conflict Resolution', gap: 'Needed for Management', icon: Users, color: 'text-orange-600', bg: 'bg-orange-100', duration: '1 week', match: '82%' }
    ];
  } else {
    const isTech = category.tags?.includes('Tech') || category.tags?.includes('SaaS');
    const isHR = category.tags?.includes('HR');
    const isSales = category.tags?.includes('Sales');

    if (isTech) {
      courses = [
        { title: 'Advanced Troubleshooting', gap: `Required for ${category.title}`, icon: BrainCircuit, color: 'text-emerald-600', bg: 'bg-emerald-100', duration: '3 weeks', match: '98%' },
        { title: 'Cloud Infrastructure Basics', gap: 'Recommended skill', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-100', duration: '6 weeks', match: '90%' },
        { title: 'Agile Methodologies', gap: 'Helpful for tech roles', icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-100', duration: '2 weeks', match: '85%' }
      ];
    } else if (isHR) {
      courses = [
        { title: 'Modern Recruitment Strategies', gap: `Required for ${category.title}`, icon: Users, color: 'text-orange-600', bg: 'bg-orange-100', duration: '4 weeks', match: '96%' },
        { title: 'Employment Law 101', gap: 'Core HR competency', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100', duration: '5 weeks', match: '92%' },
        { title: 'Workplace Psychology', gap: 'Recommended skill', icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-100', duration: '3 weeks', match: '88%' }
      ];
    } else if (isSales) {
      courses = [
        { title: 'B2B Negotiation Tactics', gap: `Required for ${category.title}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', duration: '2 weeks', match: '97%' },
        { title: 'Advanced CRM Management', gap: 'Core sales competency', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-100', duration: '3 weeks', match: '94%' },
        { title: 'Public Speaking & Pitching', gap: 'Recommended skill', icon: User, color: 'text-orange-600', bg: 'bg-orange-100', duration: '4 weeks', match: '89%' }
      ];
    } else {
      courses = [
        { title: 'Advanced Hospitality Management', gap: `Required for ${category.title}`, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-100', duration: '6 weeks', match: '95%' },
        { title: 'Revenue Optimization', gap: 'Core competency', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100', duration: '4 weeks', match: '91%' },
        { title: 'Leadership in Service', gap: 'Recommended skill', icon: Users, color: 'text-orange-600', bg: 'bg-orange-100', duration: '3 weeks', match: '86%' }
      ];
    }
  }

  return (
    <div className="w-full h-full p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Skills Gap Analysis</h1>
          <p className="text-slate-500">
            Comparing your current profile (Hotel Receptionist) with <span className="font-semibold text-emerald-600">{targetRole.title}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Current Skills</h3>
            <div className="space-y-4">
              {['Customer Service', 'Booking Systems', 'Communication'].map(skill => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{skill}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-1 flex items-center justify-center">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Target Skills</h3>
            <div className="space-y-4">
              {(targetRole.skills || ['Leadership', 'Strategy', 'Advanced Tech']).map((skill: string) => {
                const hasSkill = ['Customer Service', 'Booking Systems', 'Communication'].includes(skill);
                return (
                  <div key={skill} className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${hasSkill ? 'text-slate-700' : 'text-orange-600'}`}>{skill}</span>
                    {hasSkill ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-orange-300 border-dashed" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-6">Recommended Learning Path</h2>
        <div className="grid grid-cols-3 gap-6">
          {courses.map((course, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-500/30 transition-all cursor-pointer group">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl ${course.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <course.icon className={`w-6 h-6 ${course.color}`} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{course.match} Match</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight">{course.title}</h3>
              <p className="text-sm text-slate-500 mb-6">{course.gap}</p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <span className="text-xs font-medium text-slate-400">{course.duration}</span>
                <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Start Course &rarr;</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MentorNetworkView({ category }: { category: any }) {
  const mentors = [
    { name: 'Sarah Jenkins', role: 'Hotel General Manager', company: 'Grand Plaza', image: 'https://i.pravatar.cc/150?img=44', match: '98%', tags: ['Hospitality', 'Leadership'] },
    { name: 'David Lee', role: 'Support Lead', company: 'TechFlow', image: 'https://i.pravatar.cc/150?img=33', match: '92%', tags: ['Tech', 'Customer Success'] },
    { name: 'Emily Chen', role: 'Operations Director', company: 'Global Corp', image: 'https://i.pravatar.cc/150?img=22', match: '85%', tags: ['Operations', 'Management'] },
    { name: 'Michael Brown', role: 'VP of Sales', company: 'CloudScale', image: 'https://i.pravatar.cc/150?img=11', match: '88%', tags: ['Sales', 'B2B'] },
    { name: 'Jessica Taylor', role: 'Senior Event Manager', company: 'Elite Events', image: 'https://i.pravatar.cc/150?img=55', match: '95%', tags: ['Events', 'Planning'] },
    { name: 'Robert Wilson', role: 'Director of Revenue', company: 'StayWell', image: 'https://i.pravatar.cc/150?img=66', match: '80%', tags: ['Revenue', 'Analytics'] },
  ];

  return (
    <div className="w-full h-full p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Mentor Network</h1>
            <p className="text-slate-500">Connect with industry leaders to accelerate your career transition.</p>
          </div>
          <button className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
            Find New Mentor
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          {mentors.map((mentor, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-500/30 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <img src={mentor.image} alt={mentor.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" referrerPolicy="no-referrer" />
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{mentor.match} Match</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{mentor.name}</h3>
              <p className="text-sm font-medium text-slate-600 mb-1">{mentor.role}</p>
              <p className="text-xs text-slate-400 mb-4">{mentor.company}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {mentor.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{tag}</span>
                ))}
              </div>
              <button className="w-full py-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 text-sm font-semibold rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors">
                Request Connection
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketTrendsView() {
  return (
    <div className="w-full h-full p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Market Trends 2026</h1>
          <p className="text-slate-500">Real-time insights into the evolving job market and skill demands.</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: 'AI Roles Growth', value: '+145%', trend: 'up', color: 'text-emerald-500' },
            { label: 'Remote Work', value: '42%', trend: 'stable', color: 'text-blue-500' },
            { label: 'Avg Tech Salary', value: '$135k', trend: 'up', color: 'text-emerald-500' },
            { label: 'Green Tech Jobs', value: '+85%', trend: 'up', color: 'text-emerald-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
                {stat.trend === 'up' && <TrendingUp className={`w-4 h-4 mb-1 ${stat.color}`} />}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Trending Skills */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Most In-Demand Skills</h3>
            <div className="space-y-5">
              {[
                { skill: 'Applied AI & Prompting', percentage: 95 },
                { skill: 'Data Storytelling', percentage: 82 },
                { skill: 'Emotional Intelligence (EQ)', percentage: 78 },
                { skill: 'Cloud Architecture', percentage: 70 },
                { skill: 'Cybersecurity Basics', percentage: 65 },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{item.skill}</span>
                    <span className="text-slate-500">{item.percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Industry Shifts */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Industry Shifts (2025 vs 2026)</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">AI Co-pilots are Standard</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">78% of office workers now use AI assistants daily, shifting the focus from content creation to curation and strategy.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">The "Human Touch" Premium</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Roles requiring high empathy (hospitality, care, complex B2B sales) are seeing a 25% wage premium as automation handles routine tasks.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Fractional Work Normalization</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">30% of senior professionals now hold multiple fractional roles instead of a single full-time job, enabled by asynchronous work tools.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<'career_path' | 'job_offers' | 'skills_gap' | 'mentor_network' | 'market_trends'>('career_path');
  const [activeCategory, setActiveCategory] = useState<any>(null);

  const handleNodeClick = (node: any) => {
    setActiveCategory(node);
    setActiveLayer('job_offers');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative selection:bg-emerald-500/30">
      <CyberBackground />
      <Navbar />
      <div className="flex h-[calc(100vh-80px)] relative z-10">
        <Sidebar activeCategory={activeCategory} activeLayer={activeLayer} onNavigate={setActiveLayer} />
        <main className="flex-1 relative flex items-center justify-center">
          {activeLayer === 'career_path' ? (
            <CareerMap onNodeClick={handleNodeClick} />
          ) : activeLayer === 'skills_gap' ? (
            <SkillsGapView category={activeCategory} />
          ) : activeLayer === 'mentor_network' ? (
            <MentorNetworkView category={activeCategory} />
          ) : activeLayer === 'market_trends' ? (
            <MarketTrendsView />
          ) : (
            <JobOffersMap 
              category={activeCategory} 
              onBack={() => setActiveLayer('career_path')}
              onOfferClick={setSelectedNode}
            />
          )}
        </main>
      </div>
      <CookieBanner />
      <SidePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
