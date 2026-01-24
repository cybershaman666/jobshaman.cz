import React from 'react';
import { Building, TrendingUp, Shield, Users, BrainCircuit, Target, Eye, Star, CheckCircle, Crown, Sparkles, BarChart, MessageSquare, Info, LogIn } from 'lucide-react';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PricingPlan {
  name: string;
  price: string;
  originalPrice?: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  isPromotional?: boolean;
}

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const plans: PricingPlan[] = [
    {
      name: 'Základní',
      price: 'Zdarma',
      period: '',
      description: 'Pro malé týmy a začátečníky',
      features: [
        'Až 5 inzerátů měsíčně',
        'Základní správa inzerátů',
        'Emailová podpora',
        'Základní statistiky',
        'Žádné AI funkce'
      ],
      highlighted: false
    },
    {
      name: 'Business',
      price: '4 990 Kč',
      originalPrice: '9 990 Kč',
      period: 'měsíc',
      description: 'Pro rostoucí společnosti',
      features: [
        'Neomezený počet inzerátů',
        '10 AI assessmentů měsíčně',
        'Doporučení vhodných kandidátů',
        'AI optimalizace inzerátů',
        'Prioritní podpora',
        'Pokročilé statistiky',
        'Branding firemního profilu'
      ],
      highlighted: true,
      isPromotional: true
    },
    {
      name: 'Enterprise',
      price: 'Na míru',
      period: '',
      description: 'Pro velké korporace',
      features: [
        'Všechny Business funkce',
        'Neomezené AI assessmenty',
        'Integrace s ATS systémy',
        'Dedikovaný account manager',
        'SLA garance',
        'Vlastní branding',
        'API přístupy'
      ],
      highlighted: false
    }
  ];

  const features = [
    {
      icon: BrainCircuit,
      title: 'AI Assessment Center',
      description: 'Inteligentní hodnocení kandidátů pomocí AI analýzy odpovědí, dovedností a kulturního fitu',
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
    },
    {
      icon: Target,
      title: 'Analýza Kandidátů',
      description: 'Detailní profiling kandidátů včetně analýzy rizik odchodu a kompatibilita s týmem',
      color: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400'
    },
    {
      icon: Sparkles,
      title: 'AI Optimalizace Inzerátů',
      description: 'Automatické vylepšení textu inzerátů pro maximální atraktivitu a dosažení kvalitnějších kandidátů',
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400'
    },
    {
      icon: BarChart,
      title: 'Pokročilá Analytics',
      description: 'Detailní přehledy o efektivitě inzerátů, demografice kandidátů a náklady na nábor',
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400'
    },
    {
      icon: BrainCircuit,
      title: 'AI Assessment Centrum',
      description: 'Podrobná analýza kandidátových schopností a dovedností. Ušetří až 2 kola pohovorů. Na míru pozici a zábavnou formou.',
      color: 'bg-pink-100 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400'
    },
    {
      icon: Shield,
      title: 'Transparentnost a Fair Play',
      description: 'Ověřování informací v inzerátech a eliminace klamavých praxí v náboru',
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
    }
  ];

  const stats = [
    { value: '75%', label: 'Méně času na screening' },
    { value: '40%', label: 'Nižší náklady na nábor' },
    { value: '3x', label: 'Rychlejší obsazení pozic' },
    { value: '89%', label: 'Spokojenost firem' }
  ];

  const testimonials = [
    {
      company: 'TechInnovate s.r.o.',
      role: 'HR Director',
      name: 'Petra Nováková',
      text: 'JobShaman kompletně změnil náš náborový proces. AI analýza kandidátů nám ušetřila desítky hodin měsíčně.',
      rating: 5
    },
    {
      company: 'Digital Solutions',
      role: 'Tech Lead',
      name: 'Martin Dvořák',
      text: 'Assessment Center je naprosto geniální. Rychle identifikujeme skutečné talenty bez zbytečných kolapsů.',
      rating: 5
    },
    {
      company: 'Finance Group CZ',
      role: 'Recruitment Manager',
      name: 'Lucie Horáková',
      text: 'Optimalizace inzerátů pomocí AI přinesla o 60% kvalitnějších kandidátů. Skvělá investice.',
      rating: 5
    }
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      {/* Login Button in top right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onLogin}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
        >
          <LogIn size={16} />
          Přihlásit se
        </button>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
        <div className="my-auto w-full max-w-5xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
              <Building size={12} />
              AI-Powered Recruitment Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Najímejte nejlepší <span className="text-cyan-600 dark:text-cyan-400">Talenty</span> s AI
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
              Moderní náborový platforma s AI analýzou kandidátů, Assessment Centrem a inteligentní optimalizací inzerátů. Přestaňte ztrácet čas s nevhodnými uchazeči.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onRegister}
                className="flex items-center gap-2 text-sm font-bold text-white dark:text-slate-900 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 px-6 py-2.5 rounded-lg transition-colors"
              >
                <Building size={18} />
                Začít zdarma
              </button>
              <button
                onClick={onLogin}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <LogIn size={18} />
                Přihlásit se
              </button>
              <button
                onClick={onRequestDemo}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <Eye size={18} />
                Prohlédnout demo
              </button>
            </div>
          </div>

          {/* Stats Section - Matching App Card Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp size={24} className="text-emerald-500" />
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg">Výsledky v Číslech</h3>
                </div>
                <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <Info size={14} />
                  Statistiky
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={24} className="text-purple-500" />
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg">AI Nástroje</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.color}`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* More Features */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Shield size={24} className="text-indigo-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">Další Funkce</h3>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.slice(3).map((feature, index) => (
                <div key={index} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${feature.color}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Section - Matching App Style */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Crown size={24} className="text-amber-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">Cenové Plány</h3>
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Info size={14} />
                Cena
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <div key={index} className={`relative bg-slate-50 dark:bg-slate-950 rounded-xl p-6 border-2 transition-all ${plan.highlighted
                  ? 'border-cyan-500 dark:border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
                  : plan.price === 'Zdarma'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  {plan.price === 'Zdarma' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                        Vždy zdarma
                      </div>
                    </div>
                  )}
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 bg-cyan-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                        {plan.isPromotional ? 'Akční nabídka' : 'Nejlepší volba'}
                      </div>
                    </div>
                  )}
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {plan.name}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      {plan.description}
                    </p>
                    <div className="mb-4">
                      {plan.isPromotional && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold mb-2">
                          <Sparkles size={12} />
                          Zaváděcí sleva
                        </div>
                      )}
                      <div className="space-y-1">
                        {plan.originalPrice && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg text-slate-400 line-through">
                              {plan.originalPrice}
                            </span>
                            {plan.period && (
                              <span className="text-slate-400 text-sm">
                                /{plan.period}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-bold ${plan.price === 'Zdarma'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-cyan-600 dark:text-cyan-400'
                            }`}>
                            {plan.price}
                          </span>
                          {plan.period && !plan.originalPrice && (
                            <span className="text-slate-600 dark:text-slate-400 text-sm">
                              /{plan.period}
                            </span>
                          )}
                        </div>
                      </div>
                      {plan.isPromotional && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          * Startovací cena pro začátek projektu
                        </p>
                      )}
                      {plan.name === 'Business' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Každý další AI assessment: 99 Kč
                        </p>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    {plan.features.slice(0, 4).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
                        +{plan.features.length - 4} dalších funkcí
                      </li>
                    )}
                  </ul>
                  <button
                    onClick={plan.name === 'Enterprise' ? onRequestDemo : onRegister}
                    className={`w-full py-2.5 rounded-lg font-semibold transition-all text-sm ${plan.price === 'Zdarma'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : plan.highlighted
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                  >
                    {plan.name === 'Enterprise' ? 'Kontakt' : plan.price === 'Zdarma' ? 'Začít zdarma' : 'Začít'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials - Matching App Card Style */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users size={24} className="text-blue-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">Reference Firem</h3>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 italic leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {testimonial.role} @ {testimonial.company}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA - Matching App Style */}
          <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold mb-4">
                <Building size={12} />
                Začněte hned
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Připraveni <span className="text-cyan-600 dark:text-cyan-400">zlepšit</span> nábor?
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Přidejte se ke stovkám spokojených firem a najděte ty nejlepší talenty efektivněji.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onRegister}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 rounded-lg transition-colors"
                >
                  <Building size={18} />
                  Registrovat firmu
                </button>
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-700"
                >
                  <LogIn size={18} />
                  Přihlásit se
                </button>
                <button
                  onClick={onRequestDemo}
                  className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
                >
                  <MessageSquare size={18} />
                  Domluvit demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyLandingPage;