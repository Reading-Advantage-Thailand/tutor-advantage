"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Play } from 'lucide-react';
import Link from 'next/link';

import { getClassArticles } from '../../../dashboard/classes/actions';

interface Article {
  id: string;
  title: string;
  passage: string;
  summary?: string;
  cefrLevel?: string;
  articleNumber: number;
  isCompleted?: boolean;
}

export default function SelectLessonPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadArticles() {
      setLoading(true);
      try {
        const data = await getClassArticles(classId);
        if (isMounted) {
          setArticles(data.articles || []);
        }
      } catch (err) {
        console.error("Failed to load articles:", err);
        if (isMounted) {
          setError("ไม่สามารถดึงข้อมูลบทเรียนได้ กรุณาลองใหม่อีกครั้ง");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadArticles();
    return () => { isMounted = false; };
  }, [classId]);

  const handleStartLesson = async () => {
    if (!selectedArticle) {
      setError('กรุณาเลือกบทเรียน');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Navigate to interactive page with selected article ID
      const article = articles.find(a => a.id === selectedArticle);
      router.push(`/lesson/${classId}/interactive?articleId=${selectedArticle}`);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเริ่มบทเรียน');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/classes/${classId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            เลือกบทเรียน
          </h1>
          <p className="text-sm text-muted-foreground">
            เลือกบทความสำหรับเซสชันการเรียนในวันนี้
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Articles Grid */}
      <div className="space-y-4 mb-6">
        {articles.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="pt-6 text-center text-muted-foreground">
              ยังไม่มีบทเรียนสำหรับหนังสือนี้
            </CardContent>
          </Card>
        ) : (
          articles.map((article) => (
            <Card
              key={article.id}
              onClick={() => setSelectedArticle(article.id)}
              className={`cursor-pointer border-2 transition-all ${
                selectedArticle === article.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-primary/50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Selection indicator */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                      selectedArticle === article.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}
                  >
                    {selectedArticle === article.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-semibold text-lg text-foreground truncate">
                        บท {article.articleNumber}: {article.title}
                      </h3>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {article.passage}
                    </p>

                    {article.summary && (
                      <p className="text-sm text-slate-600 mb-3 bg-slate-50 p-2 rounded border border-slate-200">
                        📝 {article.summary}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {article.isCompleted && (
                        <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1 border border-emerald-200">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          เรียนแล้ว
                        </span>
                      )}
                      {article.cefrLevel && (
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                          CEFR: {article.cefrLevel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Link href={`/dashboard/classes/${classId}`} className="flex-1">
          <Button variant="outline" className="w-full">
            ยกเลิก
          </Button>
        </Link>
        <Button
          onClick={handleStartLesson}
          disabled={!selectedArticle || loading}
          className="flex-1 gap-2"
        >
          <Play className="h-4 w-4" />
          {loading ? 'กำลังเริ่ม...' : 'เริ่มเรียน'}
        </Button>
      </div>
    </div>
  );
}
