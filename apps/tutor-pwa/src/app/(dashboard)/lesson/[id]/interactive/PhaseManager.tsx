import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PhaseManagerProps {
  currentPhase: number;
  participants: any[];
  totalAnswered: number;
  allAnsweredData: any[];
  changePhase: (phase: number) => void;
}

export const PhaseManager: React.FC<PhaseManagerProps> = ({
  currentPhase,
  participants,
  totalAnswered,
  allAnsweredData,
  changePhase,
}) => {
  const isInteractivePhase = [7, 8, 13].includes(currentPhase);
  const totalParticipants = participants.length;
  const allAnswered = totalAnswered === totalParticipants && totalParticipants > 0;

  const handleNextPhase = () => {
    if (currentPhase < 14) {
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
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <h2 className="text-4xl font-bold text-slate-800 mb-6">Phase {currentPhase} Presentation</h2>
      <p className="text-xl text-slate-600 max-w-3xl">
        (In a real app, this will fetch and display Article content, Vocabularies, or Flashcards from Reading Advantage database based on the phase.)
      </p>
    </div>
  );

  const renderMCQ = () => {
    if (allAnsweredData.length > 0) {
      // Show results chart
      const data = [
        { name: 'A', count: allAnsweredData.filter(a => a.answer === 'A').length, fill: '#ef4444' },
        { name: 'B', count: allAnsweredData.filter(a => a.answer === 'B').length, fill: '#3b82f6' },
        { name: 'C', count: allAnsweredData.filter(a => a.answer === 'C').length, fill: '#eab308' },
        { name: 'D', count: allAnsweredData.filter(a => a.answer === 'D').length, fill: '#22c55e' },
      ];
      return (
        <div className="flex-1 flex flex-col items-center">
          <h2 className="text-3xl font-bold mb-8">Results</h2>
          <div className="w-full max-w-3xl h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 24, fontWeight: 'bold' }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold mb-12">Question: What is the main idea?</h2>
        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
          <div className="bg-red-500 text-white p-8 rounded-xl text-2xl font-bold">A. Option 1</div>
          <div className="bg-blue-500 text-white p-8 rounded-xl text-2xl font-bold">B. Option 2</div>
          <div className="bg-yellow-500 text-white p-8 rounded-xl text-2xl font-bold">C. Option 3</div>
          <div className="bg-green-500 text-white p-8 rounded-xl text-2xl font-bold">D. Option 4</div>
        </div>
        <div className="mt-12 text-2xl font-medium text-slate-500">
          Answers: {totalAnswered} / {totalParticipants}
        </div>
      </div>
    );
  };

  const renderShortAnswer = () => {
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
        <h2 className="text-4xl font-bold mb-12">Type your answer to the question</h2>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl text-center">
          What are the main causes of climate change according to the passage?
        </p>
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
          disabled={isInteractivePhase && !allAnswered}
          className={`px-8 py-3 rounded-xl font-bold text-lg transition-colors ${
            isInteractivePhase && !allAnswered
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
          }`}
        >
          {isInteractivePhase && !allAnswered ? 'Waiting for answers...' : 'Next Phase'}
        </button>
      </div>
    </div>
  );
};
