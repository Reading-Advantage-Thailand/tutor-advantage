import React from 'react';

interface ArticleDisplayProps {
  articleData: any;
  phase: number;
}

export const ArticleDisplay: React.FC<ArticleDisplayProps> = ({
  articleData,
  phase
}) => {
  if (!articleData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Loading article content...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      {/* Article Title */}
      {articleData.title && (
        <h2 className="text-4xl font-bold text-slate-800 mb-6">
          {articleData.title}
        </h2>
      )}

      {/* Article Passage */}
      {articleData.passage && (
        <div className="bg-slate-50 rounded-xl p-8 max-w-3xl mb-6 text-left">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Article Content</h3>
          <p className="text-slate-700 leading-relaxed text-lg">
            {articleData.passage}
          </p>
        </div>
      )}

      {/* Article Summary */}
      {articleData.summary && (
        <div className="bg-blue-50 rounded-xl p-6 max-w-3xl mb-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Summary</h3>
          <p className="text-blue-800 leading-relaxed">
            {articleData.summary}
          </p>
        </div>
      )}

      {/* Sentences Display */}
      {articleData.sentences && Array.isArray(articleData.sentences) && articleData.sentences.length > 0 && (
        <div className="w-full max-w-3xl mb-6">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Key Sentences</h3>
          <div className="space-y-3">
            {articleData.sentences.map((item: any, index: number) => {
              // Handle if item is an object with a 'sentences' property
              const sentenceText = typeof item === 'object' ? item.sentences : item;
              return (
                <div
                  key={index}
                  className="bg-green-50 border border-green-200 rounded-lg p-4 text-left"
                >
                  <p className="text-green-900">{String(sentenceText)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vocabulary */}
      {articleData.words && Array.isArray(articleData.words) && articleData.words.length > 0 && (
        <div className="w-full max-w-4xl mb-6">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Vocabulary & Definitions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articleData.words.map((item: any, index: number) => {
              // Handle the specific structure: { vocabulary, definition: { th, en, ... } }
              const wordText = typeof item === 'object' ? (item.vocabulary || item.word || item.text) : item;
              const defTh = typeof item === 'object' && item.definition ? item.definition.th : null;
              const defEn = typeof item === 'object' && item.definition ? item.definition.en : null;
              
              return (
                <div
                  key={index}
                  className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left flex flex-col gap-1"
                >
                  <p className="font-black text-xl text-purple-900">{String(wordText)}</p>
                  {defTh && <p className="text-sm text-purple-800 font-medium">{defTh}</p>}
                  {defEn && <p className="text-xs text-purple-600/70 italic">{defEn}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CEFR and RA Level */}
      <div className="flex gap-6 mt-6 text-slate-600">
        {articleData.cefr_level && (
          <div className="text-sm">
            <p className="font-semibold text-slate-700">CEFR Level</p>
            <p className="text-lg font-bold text-blue-600">{articleData.cefr_level}</p>
          </div>
        )}
        {articleData.ra_level && (
          <div className="text-sm">
            <p className="font-semibold text-slate-700">RA Level</p>
            <p className="text-lg font-bold text-green-600">{articleData.ra_level}</p>
          </div>
        )}
      </div>
    </div>
  );
};
