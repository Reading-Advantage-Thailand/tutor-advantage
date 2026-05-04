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
}

export const PhaseManager: React.FC<PhaseManagerProps> = ({
  currentPhase,
  participants,
  totalAnswered,
  allAnsweredData,
  articleData,
  changePhase,
}) => {
  const [isChangingPhase, setIsChangingPhase] = React.useState(false);
  
  // Reset loading state when phase actually changes
  React.useEffect(() => {
    setIsChangingPhase(false);
  }, [currentPhase]);

  const isInteractivePhase = [7, 8, 13].includes(currentPhase);
  const totalParticipants = participants.length;
  
  // Can proceed if everyone answered OR if results are already showing OR if no participants
  const canProceed = !isInteractivePhase || 
                     (totalParticipants === 0) || 
                     (totalAnswered >= totalParticipants) ||
                     (allAnsweredData && allAnsweredData.length > 0);

  const handleNextPhase = () => {
    if (currentPhase < 14 && !isChangingPhase) {
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

  const renderMCQ = () => {
    const mcqQuestion = articleData?.multipleChoiceQuestions?.[0];
    const rawAnswer = mcqQuestion?.answer || '';
    const optionsData = mcqQuestion?.options || {};
    const optionKeys = Object.keys(optionsData).sort();
    
    // Map raw answer (e.g. "1") to label (e.g. "A")
    const answerIdx = optionKeys.indexOf(rawAnswer);
    const correctAnswer = answerIdx !== -1 ? String.fromCharCode(65 + answerIdx) : rawAnswer;
    
    // Map whatever keys in DB (1,2,3 or A,B,C) to A,B,C,D for UI
    const mappedOptions: Record<string, string> = {};
    optionKeys.forEach((key, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C, D
      mappedOptions[label] = optionsData[key];
    });

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
                <h3 className="text-4xl font-black text-emerald-700">{correctAnswer}</h3>
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
          {mcqQuestion?.question || 'Question'}
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

  const renderShortAnswer = () => {
    const shortAnswerQuestion = articleData?.shortAnswerQuestions?.[0];

    if (allAnsweredData.length > 0) {
      return (
        <div className="flex-1 flex flex-col items-center">
          <h2 className="text-3xl font-bold mb-8">AI Evaluated Results</h2>
          <div className="w-full max-w-4xl grid gap-4 overflow-y-auto max-h-[60vh]">
            {allAnsweredData.map((ans, idx) => (
              <div key={idx} className="bg-slate-50 border p-4 rounded-xl flex items-start gap-4 shadow-sm">
                <div className="bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-lg text-xl">
                  {ans.answer.aiScore}/5
                </div>
                <div>
                  <p className="font-semibold text-lg">"{ans.answer.text}"</p>
                  <p className="text-sm text-slate-500 mt-2">AI Feedback: {ans.answer.aiFeedback}</p>
                </div>
              </div>
            ))}
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

  const renderPhaseContent = () => {
    if (currentPhase === 1 && participants.length === 0) return renderLobby();
    if (currentPhase === 7) return renderMCQ();
    if (currentPhase === 8 || currentPhase === 13) return renderShortAnswer();
    
    // Default presentation for phases 1-6, 9-12
    return renderPresentation();
  };

  return (
    <div className="flex-1 flex flex-col">
      {renderPhaseContent()}
      
      <div className="mt-auto pt-6 border-t flex justify-between items-center">
        <div className="text-sm text-gray-500 font-medium">
          {totalParticipants} Students in class
        </div>
        <button
          onClick={handleNextPhase}
          disabled={!canProceed || isChangingPhase}
          className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 flex items-center gap-2 ${
            !canProceed || isChangingPhase
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95'
          }`}
        >
          {isChangingPhase ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </>
          ) : !canProceed ? (
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
