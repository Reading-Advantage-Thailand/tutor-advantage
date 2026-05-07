import React from 'react';

interface ArticleDisplayProps {
  articleData: any;
  phase: number;
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({ articleData, phase }) => {
  if (!articleData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Loading article content...
      </div>
    );
  }

  const words = articleData.words || [];
  const sentences = articleData.sentences || [];

  /* ─── Phase 1: Introduction ──────────────────────────────── */
  if (phase === 1) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 px-6 w-full animate-in fade-in duration-500">
        {/* Hero Banner */}
        <div className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl mb-8"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #A855F7 100%)' }}>
          <div className="p-10 text-white text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold mb-6">
              {articleData.cefr_level && <span>CEFR: {articleData.cefr_level}</span>}
              {articleData.cefr_level && articleData.ra_level && <span className="opacity-50">·</span>}
              {articleData.ra_level && <span>RA Level: {articleData.ra_level}</span>}
            </div>
            <h1 className="text-5xl font-black mb-4 leading-tight animate-in zoom-in duration-700">
              {articleData.title}
            </h1>
            <p className="text-white/80 text-xl max-w-2xl mx-auto leading-relaxed">
              {articleData.description || "ในบทเรียนนี้ เราจะมาฝึกทักษะการอ่านและเรียนรู้คำศัพท์ใหม่ๆ ไปด้วยกัน"}
            </p>
          </div>
          <div className="flex items-center justify-center gap-6 bg-black/20 py-4 px-8">
            <div className="text-center">
              <p className="text-white/60 text-xs uppercase tracking-widest">คำศัพท์</p>
              <p className="text-white font-black text-2xl">{words.length}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white/60 text-xs uppercase tracking-widest">ประโยคหลัก</p>
              <p className="text-white font-black text-2xl">{sentences.length}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white/60 text-xs uppercase tracking-widest">Phase</p>
              <p className="text-white font-black text-2xl">1 / 14</p>
            </div>
          </div>
        </div>

        {/* Tutor Checklist */}
        <div className="w-full max-w-4xl grid grid-cols-3 gap-4">
          {[
            { icon: '👋', title: 'แนะนำบทเรียน', desc: 'บอกนักเรียนว่าวันนี้จะอ่านเรื่องอะไร' },
            { icon: '🎯', title: 'ตั้งเป้าหมาย', desc: 'บอก vocab และ skills ที่จะได้เรียน' },
            { icon: '🔥', title: 'ปลุกไฟ', desc: 'ถามคำถาม pre-reading สร้าง curiosity' },
          ].map((item, i) => (
            <div key={i} className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-5 text-center hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="font-bold text-indigo-900 text-sm mb-1">{item.title}</p>
              <p className="text-indigo-600 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Phase 2: Vocabulary Preview ───────────────────────── */
  if (phase === 2) {
    const cardColors = [
      { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
      { bg: 'bg-fuchsia-500', light: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700' },
      { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
      { bg: 'bg-pink-500', light: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
      { bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
      { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    ];

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-4 mb-8 w-full max-w-5xl">
          <div className="flex-1">
            <h2 className="text-3xl font-black text-purple-900">Vocabulary Preview</h2>
            <p className="text-purple-500 text-sm mt-1">Phase 2 · ปูพื้นคำศัพท์ก่อนอ่าน</p>
          </div>
          <div className="bg-purple-600 text-white rounded-2xl px-5 py-3 text-center">
            <p className="text-3xl font-black">{words.length}</p>
            <p className="text-xs opacity-80 uppercase tracking-wider">คำศัพท์</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-5xl">
          {words.map((item: any, index: number) => {
            const wordText = typeof item === 'object' ? (item.vocabulary || item.word || item.text) : item;
            const defTh = typeof item === 'object' && item.definition ? item.definition.th : null;
            const defEn = typeof item === 'object' && item.definition ? item.definition.en : null;
            const c = cardColors[index % cardColors.length];

            return (
              <div key={index}
                className={`group relative rounded-2xl border-2 ${c.border} ${c.light} overflow-hidden cursor-default transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                style={{ minHeight: '140px' }}>
                {/* Front */}
                <div className="p-5 flex flex-col h-full">
                  <div className={`${c.bg} text-white text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full self-start mb-3`}>
                    #{index + 1}
                  </div>
                  <p className={`font-black text-2xl ${c.text} mb-1`}>{String(wordText)}</p>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-auto">
                    {defTh && <p className="text-slate-700 font-semibold text-sm">{defTh}</p>}
                    {defEn && <p className="text-slate-400 text-xs italic mt-0.5">{defEn}</p>}
                  </div>
                  {!defTh && <p className="text-slate-400 text-xs mt-auto opacity-0 group-hover:opacity-100 transition-opacity">hover เพื่อดูความหมาย</p>}
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${c.bg} opacity-40`} />
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-purple-50 border border-purple-100 rounded-xl px-6 py-3 text-purple-700 text-sm font-medium">
          💡 Hover บนการ์ดเพื่อดูความหมาย · แนะนำให้อ่านออกเสียงร่วมกับนักเรียน
        </div>
      </div>
    );
  }

  /* ─── Phase 3: First Reading ─────────────────────────────── */
  if (phase === 3) {
    const wordCount = articleData.passage ? articleData.passage.split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.round(wordCount / 180));

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 w-full max-w-5xl">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Phase 3</span>
              <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">First Reading</span>
              {articleData.cefr_level && (
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">CEFR {articleData.cefr_level}</span>
              )}
            </div>
            <h2 className="text-3xl font-black text-slate-800">{articleData.title}</h2>
          </div>
          <div className="flex gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center">
              <p className="text-blue-700 font-black text-xl">{wordCount}</p>
              <p className="text-blue-400 text-xs">words</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center">
              <p className="text-blue-700 font-black text-xl">~{readingTime}m</p>
              <p className="text-blue-400 text-xs">reading</p>
            </div>
          </div>
        </div>

        {/* Article body */}
        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8">
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-blue-500 p-10">
              <p className="text-slate-800 text-xl leading-[2.2] font-medium"
                style={{ fontFamily: 'Georgia, serif' }}>
                {articleData.passage}
              </p>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h4 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2">
                <span>📖</span> Tutor Guide
              </h4>
              <ul className="text-blue-800 text-xs space-y-2">
                <li className="flex gap-2"><span>1.</span> ให้นักเรียนอ่านในใจก่อน</li>
                <li className="flex gap-2"><span>2.</span> อย่าหยุดอธิบายคำศัพท์ ให้ผ่านไปก่อน</li>
                <li className="flex gap-2"><span>3.</span> จับเวลาและสังเกต engagement</li>
                <li className="flex gap-2"><span>4.</span> ถาม "เข้าใจเรื่องอะไรบ้าง?" หลังอ่านจบ</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <h4 className="font-bold text-slate-700 text-sm mb-2">Silent Reading Mode</h4>
              <p className="text-slate-500 text-xs">นักเรียนอ่านในใจพร้อมกัน · ครูสังเกต body language</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 4: Vocabulary Focus ──────────────────────────── */
  if (phase === 4) {
    const vocabWords: string[] = words.map((w: any) =>
      typeof w === 'object' ? (w.vocabulary || w.word || w.text || '') : String(w)
    );

    const highlightPassage = (text: string) => {
      if (!text) return null;
      const parts = text.split(/(\s+)/);
      return parts.map((part, i) => {
        const clean = part.replace(/[.,!?;:"'()]/g, '').toLowerCase();
        const match = vocabWords.find(v => v.toLowerCase() === clean);
        if (match) {
          return (
            <mark key={i} className="bg-amber-200 text-amber-900 font-bold rounded px-0.5 not-italic">
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Phase 4</span>
          <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">Vocabulary Focus</span>
          <p className="text-slate-500 text-sm ml-2">คำที่ <mark className="bg-amber-200 text-amber-900 px-1 rounded not-italic">highlight</mark> คือ vocabulary ในบทเรียนนี้</p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Passage with highlights */}
          <div className="col-span-12 md:col-span-7">
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-amber-400 p-8">
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-4">Reading Passage</h3>
              <p className="text-slate-800 text-lg leading-[2.4] font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                {highlightPassage(articleData.passage)}
              </p>
            </div>
          </div>

          {/* Vocab sidebar */}
          <div className="col-span-12 md:col-span-5">
            <div className="bg-purple-50 border-2 border-purple-100 rounded-2xl p-5 sticky top-4">
              <h3 className="text-sm font-bold text-purple-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>📚</span> Vocabulary List
              </h3>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {words.map((item: any, i: number) => {
                  const wordText = typeof item === 'object' ? (item.vocabulary || item.word || item.text) : item;
                  const defTh = typeof item === 'object' && item.definition ? item.definition.th : null;
                  const defEn = typeof item === 'object' && item.definition ? item.definition.en : null;
                  return (
                    <div key={i} className="bg-white rounded-xl p-3 border border-purple-100 shadow-sm">
                      <p className="font-black text-purple-900 text-base">{String(wordText)}</p>
                      {defTh && <p className="text-purple-700 text-sm font-medium mt-0.5">{defTh}</p>}
                      {defEn && <p className="text-slate-400 text-xs italic">{defEn}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 5: Deep Reading ──────────────────────────────── */
  if (phase === 5) {
    const comprehensionQuestions = articleData.shortAnswerQuestions?.slice(0, 3) || [];

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Phase 5</span>
          <span className="bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full border border-teal-200">Deep Reading</span>
          <span className="bg-slate-100 text-slate-500 text-xs font-medium px-3 py-1 rounded-full">Analytical Mode</span>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Passage – high contrast */}
          <div className="col-span-12 md:col-span-8">
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-10 border-t-4 border-teal-400">
              <h3 className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-6">
                📖 {articleData.title}
              </h3>
              <p className="text-slate-100 text-xl leading-[2.4] font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                {articleData.passage}
              </p>
            </div>
          </div>

          {/* Comprehension Guide */}
          <div className="col-span-12 md:col-span-4 space-y-4">
            <div className="bg-teal-50 border-2 border-teal-100 rounded-2xl p-5">
              <h4 className="font-bold text-teal-900 text-sm mb-3 flex items-center gap-2">
                🔍 Comprehension Guide
              </h4>
              <p className="text-teal-700 text-xs mb-4">ช่วยนักเรียนหาคำตอบสำหรับคำถามต่อไปนี้:</p>
              {comprehensionQuestions.length > 0 ? (
                <div className="space-y-3">
                  {comprehensionQuestions.map((q: any, i: number) => (
                    <div key={i} className="bg-white rounded-xl p-3 border border-teal-100">
                      <p className="text-teal-800 text-xs font-semibold">Q{i + 1}. {q.question}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-teal-400 text-xs italic">ให้นักเรียนจับประเด็นสำคัญของบทความ</p>
              )}
            </div>

            <div className="bg-slate-800 rounded-2xl p-5">
              <h4 className="font-bold text-slate-200 text-sm mb-2">🎙 Tutor Actions</h4>
              <ul className="text-slate-400 text-xs space-y-2">
                <li>· อ่านออกเสียงพร้อมนักเรียน</li>
                <li>· หยุดอธิบาย context ที่ยาก</li>
                <li>· ให้นักเรียน underline ประโยคสำคัญ</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 6: Key Sentences ─────────────────────────────── */
  if (phase === 6) {
    const sentenceColors = [
      'border-green-400 bg-green-50',
      'border-emerald-400 bg-emerald-50',
      'border-teal-400 bg-teal-50',
      'border-cyan-400 bg-cyan-50',
      'border-lime-400 bg-lime-50',
    ];
    const dotColors = ['bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-lime-500'];

    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-5xl">
          <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Phase 6</span>
          <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">Key Sentences</span>
          <p className="text-slate-400 text-xs ml-2">{sentences.length} ประโยคหลักในบทเรียน</p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-12 gap-6">
          {/* Timeline */}
          <div className="col-span-12 md:col-span-6">
            <h3 className="text-sm font-bold text-green-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>📝</span> Key Sentences Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-200" />
              <div className="space-y-4">
                {sentences.map((item: any, index: number) => {
                  const sentenceText = typeof item === 'object' ? item.sentences : item;
                  const c = sentenceColors[index % sentenceColors.length];
                  const d = dotColors[index % dotColors.length];
                  return (
                    <div key={index} className="flex gap-4 items-start animate-in slide-in-from-left duration-500" style={{ animationDelay: `${index * 80}ms` }}>
                      <div className={`relative z-10 w-8 h-8 rounded-full ${d} flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md`}>
                        {index + 1}
                      </div>
                      <div className={`flex-1 border-l-4 rounded-xl p-4 shadow-sm ${c}`}>
                        <p className="text-slate-800 font-semibold text-base leading-relaxed">{String(sentenceText)}</p>
                      </div>
                    </div>
                  );
                })}
                {sentences.length === 0 && (
                  <p className="text-slate-400 text-sm pl-10">ไม่มีประโยคในบทเรียนนี้</p>
                )}
              </div>
            </div>
          </div>

          {/* Passage with context */}
          <div className="col-span-12 md:col-span-6">
            <h3 className="text-sm font-bold text-green-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>📖</span> Passage Reference
            </h3>
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-green-400 p-6">
              <p className="text-slate-700 text-base leading-[2.2]">{articleData.passage}</p>
            </div>
            <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-green-800 text-xs font-bold mb-1">🎯 Tutor Tip</p>
              <p className="text-green-700 text-xs">ให้นักเรียน identify ว่าแต่ละประโยคอยู่ส่วนไหนของ passage และทำไมถึงสำคัญ</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Phase 9: Translation ───────────────────────────────── */
  if (phase === 9) {
    return (
      <div className="flex-1 flex flex-col items-center py-8 px-6 w-full animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6 w-full max-w-4xl">
          <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Phase 9</span>
          <span className="bg-orange-50 text-orange-700 text-xs font-bold px-3 py-1 rounded-full border border-orange-200">Translation</span>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border-t-4 border-orange-400 p-10 max-w-4xl w-full">
          <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-6">Reading Passage</h3>
          <p className="text-slate-800 text-xl leading-[2.4] font-medium" style={{ fontFamily: 'Georgia, serif' }}>
            {articleData.passage}
          </p>
        </div>
      </div>
    );
  }

  /* ─── Default Fallback ───────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col items-center py-8 px-6 w-full">
      {articleData.passage && (
        <div className="bg-white rounded-2xl p-10 max-w-4xl w-full shadow-xl border-t-4 border-slate-300">
          <p className="text-slate-800 leading-[2.4] text-xl font-medium">{articleData.passage}</p>
        </div>
      )}
    </div>
  );
};
