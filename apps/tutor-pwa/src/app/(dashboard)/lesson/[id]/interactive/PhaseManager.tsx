import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArticleDisplay } from './ArticleDisplay';
import { ChevronRight } from 'lucide-react';

interface PhaseManagerProps {
  currentPhase: number;
  participants: any[];
  totalAnswered: number;
  allAnsweredData: any[];
  articleData?: any;
  changePhase: (phase: number) => void;
  sessionData?: any;
}

export const PhaseManager: React.FC<PhaseManagerProps> = ({
  currentPhase,
  participants,
  totalAnswered,
  allAnsweredData,
  articleData,
  changePhase,
  sessionData,
}) => {
  const [isChangingPhase, setIsChangingPhase] = React.useState(false);
  const [canProceedDelayed, setCanProceedDelayed] = React.useState(false);
  
  // Reset loading state when phase actually changes
  React.useEffect(() => {
    setIsChangingPhase(false);
  }, [currentPhase]);

  const isInteractivePhase = [7, 8, 10, 11, 12, 13].includes(currentPhase);
  const totalParticipants = participants.length;
  
  // Can proceed if everyone answered OR if results are already showing OR if no participants
  const canProceed = !isInteractivePhase || 
                     (totalParticipants === 0) || 
                     (totalAnswered >= totalParticipants) ||
                     (allAnsweredData && allAnsweredData.length > 0);

  React.useEffect(() => {
    if (canProceed) {
      const timer = setTimeout(() => {
        setCanProceedDelayed(true);
      }, 1000); // 1 sec delay before allowing proceeding
      return () => clearTimeout(timer);
    } else {
      setCanProceedDelayed(false);
    }
  }, [canProceed]);

  const handleNextPhase = () => {
    if (currentPhase < 14 && !isChangingPhase && canProceedDelayed) {
      setIsChangingPhase(true);
      changePhase(currentPhase + 1);
    }
  };

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <h2 className="text-3xl font-bold mb-8">Waiting for students...</h2>
      <div className="flex gap-4 flex-wrap justify-center max-w-2xl">
        {participants.map((p, i) => (
          <div key={i} className="bg-slate-100 rounded-full px-6 py-3 shadow-sm font-medium">
            {p.name}
          </div>
        ))}
      </div>
      {participants.length === 0 && <p className="text-gray-400 mt-4">No one has joined yet.</p>}
    </div>
  );

  const renderPresentation = () => (
    <ArticleDisplay articleData={articleData} phase={currentPhase} />
  );

  const renderKahootGame = (question: string, mappedOptions: Record<string, string>, correctAnswer: string) => {
    if (allAnsweredData.length > 0) {
      // Show results chart
      const data = [
        { name: 'A', count: allAnsweredData.filter(a => a.answer === 'A').length, fill: correctAnswer === 'A' ? '#10b981' : '#ef4444' },
        { name: 'B', count: allAnsweredData.filter(a => a.answer === 'B').length, fill: correctAnswer === 'B' ? '#10b981' : '#3b82f6' },
        { name: 'C', count: allAnsweredData.filter(a => a.answer === 'C').length, fill: correctAnswer === 'C' ? '#10b981' : '#eab308' },
        { name: 'D', count: allAnsweredData.filter(a => a.answer === 'D').length, fill: correctAnswer === 'D' ? '#10b981' : '#22c55e' },
      ];

      const correctCount = allAnsweredData.filter(a => a.answer === correctAnswer).length;
      const wrongCount = allAnsweredData.length - correctCount;

      return (
        <div className="flex-1 flex flex-col items-center">
          <h2 className="text-3xl font-bold mb-4 text-slate-800">สรุปผลการตอบ</h2>
          
          <div className="w-full max-w-2xl h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 20, fontWeight: 'bold' }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 w-full max-w-2xl">
             <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                <p className="text-emerald-600 font-bold text-sm uppercase mb-1">เฉลยที่ถูกต้อง</p>
                <h3 className="text-4xl font-black text-emerald-700">{correctAnswer}: {mappedOptions[correctAnswer]}</h3>
             </div>
             <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-center">
                <p className="text-slate-500 font-bold text-sm uppercase mb-1">สถิติความถูกต้อง</p>
                <div className="flex items-center justify-center gap-4">
                   <span className="text-emerald-600 font-bold text-2xl">ถูก {correctCount}</span>
                   <span className="text-slate-300">|</span>
                   <span className="text-rose-500 font-bold text-2xl">ผิด {wrongCount}</span>
                </div>
             </div>
          </div>
        </div>
      );
    }

    const displayKeys = Object.keys(mappedOptions).sort();

    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold mb-12 text-center max-w-4xl text-slate-800">
          {question}
        </h2>
        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
          {displayKeys.map((key) => {
            const colorMap: Record<string, string> = { 'A': 'red', 'B': 'blue', 'C': 'yellow', 'D': 'green' };
            const color = colorMap[key] || 'slate';
            const bgClasses: Record<string, string> = {
              'red': 'bg-red-500',
              'blue': 'bg-blue-500',
              'yellow': 'bg-yellow-500',
              'green': 'bg-green-500'
            };
            const bgClass = bgClasses[color] || 'bg-slate-500';

            return (
              <div key={key} className={`${bgClass} text-white p-8 rounded-2xl text-2xl font-bold shadow-lg flex items-start gap-4`}>
                <span className="bg-white/20 px-3 py-1 rounded-lg">{key}</span>
                <span>{mappedOptions[key]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-2xl font-bold text-slate-400 bg-slate-100 px-8 py-3 rounded-full">
          ส่งคำตอบแล้ว: {totalAnswered} / {totalParticipants} คน
        </div>
      </div>
    );
  };

  const renderMCQ = () => {
    const idx = sessionData?.phaseSelectedIndices?.[7] || 0;
    const mcqQuestion = articleData?.multipleChoiceQuestions?.[idx];
    const rawAnswer = mcqQuestion?.answer || '';
    const optionsData = mcqQuestion?.options || {};
    const optionKeys = Object.keys(optionsData).sort();
    
    // 1. Try to match raw answer string against full option text
    let answerIdx = -1;
    optionKeys.forEach((key, i) => {
      if (optionsData[key] === rawAnswer) {
        answerIdx = i;
      }
    });

    // 2. Fallback: Check if it is an index or key like "1"
    if (answerIdx === -1) {
      const i = optionKeys.indexOf(rawAnswer);
      if (i !== -1) {
        answerIdx = i;
      } else {
        // Fallback 3: Is it "A", "B", "C", "D"?
        const labelIdx = String(rawAnswer).charCodeAt(0) - 65;
        if (labelIdx >= 0 && labelIdx < optionKeys.length) {
          answerIdx = labelIdx;
        }
      }
    }

    const rawOptions = optionKeys.map(key => optionsData[key]);
    const correctOptionText = answerIdx !== -1 ? rawOptions[answerIdx] : rawAnswer;

    // Deterministic shuffle
    const shuffledOptions = [...rawOptions];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor((i + 1) * 0.47) % (i + 1);
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    // Now find the new index of correct text
    const newCorrectIdx = shuffledOptions.indexOf(correctOptionText);
    const correctAnswer = newCorrectIdx !== -1 ? String.fromCharCode(65 + newCorrectIdx) : rawAnswer;
    
    // Map to A, B, C, D for UI
    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(mcqQuestion?.question || 'Question', mappedOptions, correctAnswer);
  };

  const renderVocabKahoot = () => {
    const words = articleData?.words || [];
    if (words.length < 4) return <div className="flex-1 flex items-center justify-center text-xl">Not enough vocabulary words to play.</div>;

    const idx = sessionData?.phaseSelectedIndices?.[10] || 0;
    const targetWord = words[idx] || words[0];
    const question = `ความหมายของคำว่า "${targetWord.vocabulary || targetWord.word || targetWord.text}" คืออะไร?`;
    
    const correctTranslation = targetWord.definition?.th || targetWord.translation || "ความหมายที่ถูกต้อง";
    const distractorWords = words.filter((w: any, i: number) => i !== idx);

    const usedTranslations = new Set<string>([correctTranslation]);
    const optionsArray: string[] = [correctTranslation];

    distractorWords.forEach((w: any) => {
      const trans = w?.definition?.th || w?.translation;
      if (trans && !usedTranslations.has(trans) && optionsArray.length < 4) {
        usedTranslations.add(trans);
        optionsArray.push(trans);
      }
    });

    let fillCounter = 1;
    while (optionsArray.length < 4) {
      const fb = `ความหมายอื่น ${String.fromCharCode(65 + fillCounter)}`;
      if (!usedTranslations.has(fb)) {
        usedTranslations.add(fb);
        optionsArray.push(fb);
      }
      fillCounter++;
    }

    const shuffledOptions = [...optionsArray];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor((i + 1) * 0.47) % (i + 1);
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    const newCorrectIdx = shuffledOptions.indexOf(correctTranslation);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(question, mappedOptions, correctLabel);
  };

  const renderSentenceFlashcardKahoot = () => {
    const sentences = articleData?.sentences || [];
    if (sentences.length < 1) return <div className="flex-1 flex items-center justify-center text-xl">Not enough sentences to play.</div>;

    const idx = sessionData?.phaseSelectedIndices?.[11] || 0;
    const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
    const words = String(targetSentence).split(' ');
    if (words.length < 3) return <div className="flex-1 flex items-center justify-center text-xl">Sentence too short to play.</div>;
    
    const correctWord = words[words.length - 1].replace(/[.,!?]/g, '');
    const displaySentence = words.slice(0, words.length - 1).join(' ') + ' _____';
    
    const question = `เติมคำในช่องว่าง: ${displaySentence}`;
    
    const vocabWords = articleData?.words?.map((w: any) => w.vocabulary || w.word || w.text) || ["Apple", "Banana", "Cat"];
    const distractors = vocabWords.filter((w: string) => w.toLowerCase() !== correctWord.toLowerCase());
    
    const optionsArray = [correctWord, distractors[0] || "Word A", distractors[1] || "Word B", distractors[2] || "Word C"];

    const shuffledOptions = [...optionsArray];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor((i + 1) * 0.47) % (i + 1);
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    const newCorrectIdx = shuffledOptions.indexOf(correctWord);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    return renderKahootGame(question, mappedOptions, correctLabel);
  };

  const renderSentenceOrderingKahoot = () => {
    const sentences = articleData?.sentences || [];
    if (sentences.length < 1) return <div className="flex-1 flex items-center justify-center text-xl">Not enough sentences to play.</div>;

    const idx = sessionData?.phaseSelectedIndices?.[12] || 0;
    const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
    const words = String(targetSentence).split(' ').filter((w: any) => String(w).trim().length > 0);
    
    // Shuffle the sentence words randomly
    const shuffleWords = (array: string[]) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor((i + 1) * 0.47) % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (arr.join(' ') === array.join(' ')) {
        arr.reverse();
      }
      return arr;
    };

    const scrambled = shuffleWords(words).join(' / ');
    const question = `เรียงประโยคให้ถูกต้อง: ${scrambled}`;
    
    const optA = [...words]; optA.push(optA.shift()!); 
    const optB = [...words]; optB.unshift(optB.pop()!);
    const optC = [...words].reverse();
    
    const optionsArray = [targetSentence, optA.join(' '), optB.join(' '), optC.join(' ')];

    const shuffledOptions = [...optionsArray];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor((i + 1) * 0.47) % (i + 1);
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    const newCorrectIdx = shuffledOptions.indexOf(targetSentence);
    const correctLabel = String.fromCharCode(65 + newCorrectIdx);

    const mappedOptions: Record<string, string> = {};
    shuffledOptions.forEach((val, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C, D
      mappedOptions[label] = val;
    });

    const finalQuestion = scrambled === targetSentence ? `เรียงประโยคให้ถูกต้อง: ${[...words].reverse().join(' / ')}` : question;
    return renderKahootGame(finalQuestion, mappedOptions, correctLabel);
  };

  const renderShortAnswer = () => {
    const idx = sessionData?.phaseSelectedIndices?.[currentPhase] || 0;
    const shortAnswerQuestion = articleData?.shortAnswerQuestions?.[idx] || articleData?.shortAnswerQuestions?.[0];

    if (allAnsweredData.length > 0) {
      // Calculate score ranges counts
      const excellentCount = allAnsweredData.filter(a => (a.answer?.aiScore || 0) >= 4).length;
      const goodCount = allAnsweredData.filter(a => (a.answer?.aiScore || 0) >= 2 && (a.answer?.aiScore || 0) <= 3).length;
      const improveCount = allAnsweredData.filter(a => (a.answer?.aiScore || 0) >= 0 && (a.answer?.aiScore || 0) <= 1).length;

      const sumScores = allAnsweredData.reduce((acc, a) => acc + (a.answer?.aiScore || 0), 0);
      const averageScore = allAnsweredData.length > 0 ? sumScores / allAnsweredData.length : 0;

      const chartData = [
        { name: 'ดีเยี่ยม (4-5)', count: excellentCount, fill: '#10b981' },
        { name: 'พอใช้ (2-3)', count: goodCount, fill: '#f59e0b' },
        { name: 'ปรับปรุง (0-1)', count: improveCount, fill: '#f43f5e' }
      ];

      return (
        <div className="flex-1 flex flex-col items-center">
          <h2 className="text-3xl font-bold mb-6 text-slate-800">สรุปผลการประเมินโดย AI (Short Answer)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
            {/* Left: Distribution Bar Chart */}
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col items-center justify-center h-80">
              <h4 className="text-lg font-bold text-slate-700 mb-4 self-start">กราฟสถิติช่วงคะแนนของนักเรียน</h4>
              <div className="w-full h-full max-h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 14, fontWeight: 'bold' }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Detailed Summary Cards & Average */}
            <div className="flex flex-col gap-4 justify-between h-80">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-center">
                  <p className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">ส่งคำตอบแล้วทั้งหมด</p>
                  <h3 className="text-3xl font-black text-blue-700">{allAnsweredData.length} <span className="text-lg font-normal text-blue-500">คน</span></h3>
                </div>
                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 text-center">
                  <p className="text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">คะแนนเฉลี่ย</p>
                  <h3 className="text-3xl font-black text-indigo-700">{averageScore.toFixed(1)} <span className="text-lg font-normal text-indigo-500">/ 5</span></h3>
                </div>
              </div>

              {/* Range KPIs in a compact layout */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center flex flex-col justify-between">
                  <p className="text-emerald-700 font-bold text-xs">ดีเยี่ยม (4-5)</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">{excellentCount} คน</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center flex flex-col justify-between">
                  <p className="text-amber-700 font-bold text-xs">พอใช้ (2-3)</p>
                  <p className="text-xl font-black text-amber-600 mt-1">{goodCount} คน</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center flex flex-col justify-between">
                  <p className="text-rose-700 font-bold text-xs">ปรับปรุง (0-1)</p>
                  <p className="text-xl font-black text-rose-600 mt-1">{improveCount} คน</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 border border-slate-200 p-4 rounded-xl max-w-4xl text-center flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <p className="text-slate-600 text-sm font-medium">เพื่อความปลอดภัยและความเป็นส่วนตัว ระบบจะไม่แสดงคำตอบส่วนบุคคลของนักเรียนบนหน้าจอนี้</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold mb-12 text-center">
          {shortAnswerQuestion?.question || 'Type your answer to the question'}
        </h2>
        <div className="mt-8 text-2xl font-medium text-slate-500">
          Answers Submitted: {totalAnswered} / {totalParticipants}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    // Sort participants by score descending
    const sortedParticipants = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        <div className="text-center mb-8 animate-in fade-in zoom-in">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">สรุปอันดับบทเรียน (Leaderboard)</h2>
          <p className="text-slate-500 mt-1 font-medium">ยินดีด้วยกับนักเรียนทุกคนที่ตั้งใจเรียนในวันนี้!</p>
        </div>

        {/* 1st, 2nd, 3rd Podiums */}
        <div className="grid grid-cols-3 gap-6 w-full items-end mb-12 min-h-[260px]">
          {/* 2nd Place */}
          {sortedParticipants[1] ? (
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 text-center flex flex-col items-center justify-between shadow-sm animate-in slide-in-from-bottom duration-500 h-[210px] relative border-b-4 border-b-slate-300">
              <div className="absolute top-[-16px] bg-slate-200 border-2 border-white text-slate-700 font-bold w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm">
                2
              </div>
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 mt-2 mb-2 flex items-center justify-center">
                <img src={sortedParticipants[1].pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[1].name}`} alt={sortedParticipants[1].name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg truncate w-full">{sortedParticipants[1].name}</h3>
              <p className="text-slate-500 font-black text-2xl">{sortedParticipants[1].score || 0} <span className="text-xs font-medium">คะแนน</span></p>
            </div>
          ) : (
            <div className="h-[210px]" />
          )}

          {/* 1st Place */}
          {sortedParticipants[0] ? (
            <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-200 rounded-2xl p-6 text-center flex flex-col items-center justify-between shadow-md animate-in slide-in-from-bottom duration-700 h-[260px] relative border-b-4 border-b-amber-500 scale-105">
              <div className="absolute top-[-20px] bg-amber-400 border-2 border-white text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-md animate-bounce">
                👑
              </div>
              <div className="w-20 h-20 rounded-full overflow-hidden bg-amber-50 border-4 border-amber-400 mt-2 mb-2 flex items-center justify-center">
                <img src={sortedParticipants[0].pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[0].name}`} alt={sortedParticipants[0].name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-black text-amber-900 text-xl truncate w-full">{sortedParticipants[0].name}</h3>
              <p className="text-amber-600 font-black text-3xl">{sortedParticipants[0].score || 0} <span className="text-sm font-medium">คะแนน</span></p>
            </div>
          ) : (
            <div className="h-[260px]" />
          )}

          {/* 3rd Place */}
          {sortedParticipants[2] ? (
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 text-center flex flex-col items-center justify-between shadow-sm animate-in slide-in-from-bottom duration-300 h-[180px] relative border-b-4 border-b-amber-700">
              <div className="absolute top-[-16px] bg-amber-700 border-2 border-white text-white font-bold w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm">
                3
              </div>
              <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 mt-2 mb-2 flex items-center justify-center">
                <img src={sortedParticipants[2].pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sortedParticipants[2].name}`} alt={sortedParticipants[2].name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-slate-800 text-base truncate w-full">{sortedParticipants[2].name}</h3>
              <p className="text-slate-500 font-black text-xl">{sortedParticipants[2].score || 0} <span className="text-xs font-medium">คะแนน</span></p>
            </div>
          ) : (
            <div className="h-[180px]" />
          )}
        </div>

        {/* All participants list (4th and below) */}
        {sortedParticipants.length > 3 && (
          <div className="w-full bg-white border border-slate-100 rounded-2xl p-4 max-h-[25vh] overflow-y-auto grid gap-2">
            {sortedParticipants.slice(3).map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 w-6 text-center">{i + 4}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden border">
                    <img src={p.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-bold text-slate-800">{p.name}</span>
                </div>
                <span className="font-black text-slate-600 text-lg">{p.score || 0} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPhaseContent = () => {
    if (currentPhase === 0 && participants.length === 0) return renderLobby();
    if (currentPhase === 7) return renderMCQ();
    if (currentPhase === 10) return renderVocabKahoot();
    if (currentPhase === 11) return renderSentenceFlashcardKahoot();
    if (currentPhase === 12) return renderSentenceOrderingKahoot();
    if (currentPhase === 8 || currentPhase === 13) return renderShortAnswer();
    if (currentPhase === 14) return renderLeaderboard();
    
    // Default presentation for phases 1-6, 9
    return renderPresentation();
  };

  const phaseGroups = [
    { label: 'Intro', phases: [1, 2], color: 'bg-indigo-500', lightColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    { label: 'Reading', phases: [3, 4, 5, 6], color: 'bg-blue-500', lightColor: 'bg-blue-100', textColor: 'text-blue-700' },
    { label: 'MCQ', phases: [7, 8], color: 'bg-rose-500', lightColor: 'bg-rose-100', textColor: 'text-rose-700' },
    { label: 'Translation', phases: [9], color: 'bg-orange-500', lightColor: 'bg-orange-100', textColor: 'text-orange-700' },
    { label: 'Games', phases: [10, 11, 12, 13], color: 'bg-purple-500', lightColor: 'bg-purple-100', textColor: 'text-purple-700' },
    { label: 'Wrap-up', phases: [14], color: 'bg-amber-500', lightColor: 'bg-amber-100', textColor: 'text-amber-700' },
  ];

  const phaseNames: Record<number, string> = {
    0: 'Lobby', 1: 'Intro', 2: 'Vocab Preview', 3: 'First Reading', 4: 'Vocab Focus',
    5: 'Deep Reading', 6: 'Key Sentences', 7: 'MCQ Quiz', 8: 'Short Answer',
    9: 'Translation', 10: 'Vocab Kahoot', 11: 'Sentence Fill', 12: 'Sentence Order',
    13: 'Short Answer 2', 14: 'Leaderboard',
  };

  const renderPhaseProgressBar = () => {
    if (currentPhase === 0) return null;
    const currentGroup = phaseGroups.find(g => g.phases.includes(currentPhase));

    return (
      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${currentGroup?.lightColor || 'bg-slate-100'} ${currentGroup?.textColor || 'text-slate-600'}`}>
              Phase {currentPhase}
            </span>
            <span className="font-bold text-slate-800 text-sm">{phaseNames[currentPhase] || `Phase ${currentPhase}`}</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">{currentPhase} / 14</span>
        </div>

        {/* Phase dots */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 14 }, (_, i) => i + 1).map((p) => {
            const group = phaseGroups.find(g => g.phases.includes(p));
            const isPast = p < currentPhase;
            const isCurrent = p === currentPhase;
            return (
              <div key={p} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-2 w-full rounded-full transition-all duration-500 ${
                  isCurrent ? `${group?.color || 'bg-slate-400'} shadow-md scale-y-150` :
                  isPast ? (group?.color || 'bg-slate-300') + ' opacity-60' :
                  'bg-slate-200'
                }`} />
              </div>
            );
          })}
        </div>

        {/* Group labels */}
        <div className="flex mt-2 text-[10px] text-slate-400 font-medium">
          {phaseGroups.map((g) => (
            <div key={g.label} style={{ flex: g.phases.length }} className="text-center">
              {g.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Warning Overlay when everyone left */}
      {currentPhase > 0 && participants.length === 0 && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-red-100 flex flex-col items-center max-w-md text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 text-3xl">
              ⚠️
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">นักเรียนออกจากห้องหมดแล้ว</h3>
            <p className="text-slate-500 mb-8">ไม่มีนักเรียนเหลืออยู่ในเซสชันนี้เลย คุณครูสามารถกลับไปรอที่ Lobby เพื่อให้นักเรียนเข้ามาใหม่ได้</p>
            <button 
              onClick={() => changePhase(0)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 w-full"
            >
              กลับสู่ Lobby ทันที
            </button>
          </div>
        </div>
      )}

      {renderPhaseProgressBar()}
      {renderPhaseContent()}
      
      <div className="mt-auto pt-6 border-t flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 font-medium">
            {totalParticipants} Students in class
          </div>

          {/* Always Available Return to Lobby */}
          <button 
            onClick={() => changePhase(0)}
            className="px-3 py-1.5 bg-rose-50 text-rose-600 text-sm font-semibold rounded-lg hover:bg-rose-100 transition-colors ml-2"
          >
            กลับสู่ Lobby
          </button>
          
          {/* Dev Mode Controls */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">DEV</span>
              <button 
                onClick={() => changePhase(Math.max(1, currentPhase - 1))}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                ย้อนกลับ
              </button>
              <button 
                onClick={() => changePhase(Math.min(15, currentPhase + 1))}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Skip Phase
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleNextPhase}
          disabled={!canProceedDelayed || isChangingPhase}
          className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 flex items-center gap-2 ${
            !canProceedDelayed || isChangingPhase
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95'
          }`}
        >
          {isChangingPhase ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </>
          ) : !canProceedDelayed ? (
            'Waiting for answers...'
          ) : (
            <>
              Next Phase
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
