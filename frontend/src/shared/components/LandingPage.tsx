import React, { useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  Languages,
  Scale,
  ShieldCheck,
  Video,
  Users,
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

const services = [
  { icon: HeartPulse, title: 'Healthcare', text: 'Better care through clear communication.' },
  { icon: Scale, title: 'Legal & Court', text: 'Accurate support for rights and proceedings.' },
  { icon: BriefcaseBusiness, title: 'Business & Community', text: 'Bridge language gaps where they matter.' },
  { icon: GraduationCap, title: 'Education', text: 'Learning and growth without language barriers.' },
];

const steps = [
  { title: 'Choose your languages', text: 'Tell us the speaker’s language and the language the team needs.' },
  { title: 'Submit a request', text: 'Add the service category, urgency, and routing context.' },
  { title: 'Connect securely', text: 'Join an available interpreter by audio or video.' },
];

const languages = ['Amharic', 'Afaan Oromoo', 'Tigrinya', 'Somali', 'Sidama', 'Wolaytta', 'English', 'Arabic'];

const questions = [
  { q: 'How do I request an interpreter?', a: 'Sign in, choose the languages and service category, then submit the intake form.' },
  { q: 'Can I schedule a request?', a: 'Yes. Choose a scheduled time on the intake form when the conversation is not immediate.' },
  { q: 'What if nobody recognizes the dialect?', a: 'Mark the language as unknown. A coordinator reviews it and the platform does not guess.' },
  { q: 'How do I join a session?', a: 'When an interpreter is assigned, open the request and join the live room.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const visibleLanguages = showAllLanguages ? languages : languages.slice(0, 4);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-[#111827]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6D4AFF] text-white shadow-lg shadow-violet-200">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-xl font-black tracking-tight text-[#111827]">ORZO</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Connect · Communicate · Belong</span>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 lg:flex">
            <a className="text-[#6D4AFF]" href="#top">Home</a>
            <a className="hover:text-[#6D4AFF]" href="#services">Services</a>
            <a className="hover:text-[#6D4AFF]" href="#how">How It Works</a>
            <a className="hover:text-[#6D4AFF]" href="#about">About</a>
            <a className="hover:text-[#6D4AFF]" href="#help">Contact</a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onLogin} className="hidden rounded-xl border border-[#6D4AFF] px-4 py-2.5 text-sm font-bold text-[#5B3DE8] sm:block">
              Client Login
            </button>
            <button type="button" onClick={onLogin} className="flex items-center gap-2 rounded-xl bg-[#6D4AFF] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:-translate-y-0.5">
              Request Interpreter <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section id="about" className="relative overflow-hidden">
          <div className="mx-auto grid min-h-[620px] max-w-[1380px] items-center gap-8 px-5 py-14 lg:grid-cols-[52%_48%] lg:px-8">
            <div className="relative z-10 max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-[#6D4AFF]">
                <ShieldCheck className="h-4 w-4" /> Bridging language gaps in Ethiopia
              </div>
              <h1 className="text-[3rem] font-black leading-[1.04] tracking-[-0.045em] text-[#111827] sm:text-[4.25rem] lg:text-[5.25rem]">
                Every voice
                <span className="block">matters in <span className="text-[#6D4AFF]">Ethiopia</span></span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Connect with professional interpreters for clear, confident communication across healthcare, courts, public services, and communities.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={onLogin} className="flex h-14 items-center gap-3 rounded-2xl bg-[#6D4AFF] px-7 text-base font-bold text-white shadow-xl shadow-violet-200 hover:-translate-y-1">
                  Request an Interpreter <ArrowRight className="h-5 w-5" />
                </button>
                <a href="#services" className="flex h-14 items-center gap-3 rounded-2xl border-2 border-violet-200 bg-white px-7 text-base font-bold text-[#5B3DE8] hover:border-[#6D4AFF]">
                  Explore Our Services
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-600">
                <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /> Trusted & secure</span>
                <span className="flex items-center gap-2"><Users className="h-5 w-5 text-violet-500" /> Professional interpreters</span>
                <span className="flex items-center gap-2"><Video className="h-5 w-5 text-amber-500" /> Audio & video</span>
              </div>
            </div>

            <div className="relative min-h-[430px] self-center lg:min-h-[520px] lg:-translate-y-4">
              <div className="absolute inset-4 rounded-[3rem] bg-[radial-gradient(circle_at_70%_30%,#ede9fe,transparent_38%),linear-gradient(145deg,#eff6ff,#f5f3ff)]" />
              <img src="/welcome-illustration.png" alt="ORZO interpretation platform" className="absolute bottom-1 right-[-1%] h-[98%] w-[98%] object-contain object-bottom" />
              <div className="absolute right-2 top-16 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-violet-200/70 backdrop-blur">
                <p className="text-xs font-black text-[#6D4AFF]">Live interpretation</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Ethiopian language support</p>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-[1380px] px-5 pb-14 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <article key={service.title} className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-[#6D4AFF]">
                  <service.icon className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-lg font-black">{service.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{service.text}</p>
                <button type="button" onClick={onLogin} className="mt-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-[#6D4AFF] group-hover:bg-[#6D4AFF] group-hover:text-white" aria-label={`Request ${service.title}`}>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="bg-[#111827] py-20 text-white">
          <div className="mx-auto max-w-[1380px] px-5 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-violet-300">How it works</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Three steps to clear communication</h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <article key={step.title} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6D4AFF] text-sm font-black">{index + 1}</div>
                  <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1380px] gap-5 px-5 py-16 lg:grid-cols-[1fr_360px] lg:px-8">
          <div id="languages" className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6D4AFF]">Language availability</p>
            <h2 className="mt-2 text-2xl font-black">Supported languages</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleLanguages.map((language) => (
                <div key={language} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
                  {language}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowAllLanguages((value) => !value)} className="mt-5 text-sm font-bold text-[#6D4AFF]">
              {showAllLanguages ? 'Show fewer' : 'View all languages'}
            </button>
          </div>

          <aside id="help" className="rounded-[1.75rem] bg-[#F59E0B] p-7 text-[#111827]">
            <ShieldCheck className="h-8 w-8" />
            <h2 className="mt-5 text-2xl font-black">Need help?</h2>
            <p className="mt-2 text-sm font-medium leading-6">Sign in and use ORZO Support for dispatch questions and dialect identification.</p>
            <button type="button" onClick={onLogin} className="mt-6 h-11 rounded-xl bg-[#111827] px-5 text-sm font-bold text-white">Contact Support</button>
          </aside>
        </section>

        <section className="mx-auto max-w-[1380px] px-5 pb-16 lg:px-8">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-black">Frequently asked questions</h2>
            <div className="mt-5 divide-y divide-slate-200">
              {questions.map((item, index) => (
                <div key={item.q}>
                  <button type="button" onClick={() => setOpenQuestion(openQuestion === index ? null : index)} className="flex w-full items-center justify-between py-4 text-left font-bold">
                    {item.q}
                    <ChevronDown className={`h-5 w-5 transition-transform ${openQuestion === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openQuestion === index && <p className="pb-4 text-sm leading-6 text-slate-600">{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#111827] text-slate-300">
        <div className="mx-auto flex max-w-[1380px] flex-col gap-5 px-5 py-8 text-sm md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6D4AFF] text-white"><Languages className="h-5 w-5" /></div>
            <div><p className="font-black text-white">ORZO</p><p className="text-xs text-slate-400">© 2026. All rights reserved.</p></div>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="#about">About Orzo</a><a href="#how">How It Works</a><a href="#help">Help & Support</a>
            <button type="button" onClick={onLogin}>Log in</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
