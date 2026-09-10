"use client";

import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "../lib/api";

type Stage = "PRE" | "POST";
type Skill = "vocabulary" | "reading" | "listening";
type Attempt = { attemptId: string; articleId?: string; stage: Stage; submittedAt: string | null; total: number | null; scores: Record<Skill, number> | null; teacherComment: string | null };
type Summary = { supported: boolean; title?: string; articles?: { articleId: string; title: string }[]; attempts: Attempt[] };
const names: Record<Skill, string> = { vocabulary: "คำศัพท์", reading: "อ่านจับใจความ", listening: "ฟังเข้าใจ" };
const buttonStyle = { padding: "10px 16px", borderRadius: 12, background: "var(--brand-600, #07834b)", color: "white", fontWeight: 700, cursor: "pointer" } as const;

export default function AssessmentPanel({ cycleId, classId }: { cycleId: string; classId?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const base = `/book-cycles/${encodeURIComponent(cycleId)}/assessment`;
  useEffect(() => {
    let active = true;
    fetchWithAuth(base).then(result => {
      if (!active) return;
      setData(result);
      const latest = [...(result.attempts || [])].filter((attempt) => attempt.submittedAt).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
      setSelectedArticleId(latest?.articleId || result.articles?.[0]?.articleId || "");
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [base]);
  if (data && !data.supported) return null;
  const articleAttempts = data?.attempts.filter((attempt) => !selectedArticleId || !attempt.articleId || attempt.articleId === selectedArticleId) || [];
  const pre = articleAttempts.find(a => a.stage === "PRE" && a.submittedAt);
  const post = articleAttempts.find(a => a.stage === "POST" && a.submittedAt);
  const selectedArticle = data?.articles?.find((article) => article.articleId === selectedArticleId);
  return <section className="glass-card" style={{ padding: 20, color: "var(--text-primary)", display: "grid", gap: 16 }} aria-label="พัฒนาการก่อนและหลังเรียน">
    <div><p style={{ fontSize: 12, color: "var(--text-secondary)" }}>ประเมินประจำบท · {data?.title || "บทเรียนของฉัน"}</p><h2 style={{ fontSize: 20, fontWeight: 800 }}>เห็นพัฒนาการของตัวเอง</h2></div>
    {error && <p role="alert" style={{ color: "var(--error, #b91c1c)" }}>{error} {!data && <button style={buttonStyle} onClick={() => { setError(""); fetchWithAuth(base).then(setData).catch(e => setError(e.message)); }}>ลองอีกครั้ง</button>}</p>}
    {!data && !error && <p role="status">กำลังโหลดแบบประเมิน…</p>}
    {data && <>
      {(data.articles?.length || 0) > 1 && <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>เลือกบทเรียน
        <select value={selectedArticleId} onChange={(event) => setSelectedArticleId(event.target.value)} style={{ minHeight: 42, borderRadius: 12, padding: "0 12px", background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {data.articles?.map((article) => <option key={article.articleId} value={article.articleId}>{article.title}</option>)}
        </select>
      </label>}
      {selectedArticle && <p style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{selectedArticle.title}</p>}
      <p style={{ color: "var(--text-secondary)" }}>15 ข้อ · ประมาณ 8–10 นาที · คำศัพท์ อ่าน และฟัง เตรียมเปิดเสียงและทำด้วยตัวเอง</p>
      {(pre || post) && <>
        <div style={{ display: "flex", gap: 24 }}><div>ก่อนเรียน<strong style={{ display: "block", fontSize: 26 }}>{pre ? `${pre.total}/15` : "ยังไม่มีผล"}</strong></div><div>หลังเรียน<strong style={{ display: "block", fontSize: 26 }}>{post ? `${post.total}/15` : "ยังไม่มีผล"}</strong></div></div>
        {pre && post && <p style={{ fontWeight: 700 }}>{post.total! > pre.total! ? `ตอบถูกเพิ่มขึ้น ${post.total! - pre.total!} ข้อ` : post.total === pre.total ? "คะแนนเท่ากับครั้งก่อน" : "ผลครั้งนี้ต่ำกว่าครั้งก่อน ลองปรึกษาครูเพื่อวางแผนฝึกต่อ"}</p>}
        {post && !pre && <p>ไม่มีผลก่อนเรียน จึงยังสรุปพัฒนาการไม่ได้</p>}
        <table style={{ width: "100%", textAlign: "left" }}><caption style={{ textAlign: "left", marginBottom: 8 }}>ผลรายทักษะ (เต็มทักษะละ 5 ข้อ)</caption><thead><tr><th>ทักษะ</th><th>ก่อน</th><th>หลัง</th></tr></thead><tbody>{(Object.keys(names) as Skill[]).map(skill => <tr key={skill}><td style={{ padding: "8px 0" }}>{names[skill]}</td><td>{pre?.scores?.[skill] ?? "—"}</td><td>{post?.scores?.[skill] ?? "—"}</td></tr>)}</tbody></table>
        {(post?.teacherComment || pre?.teacherComment) && <div><strong>คำแนะนำจากครู</strong><p style={{ whiteSpace: "pre-wrap" }}>{post?.teacherComment || pre?.teacherComment}</p></div>}
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>เป็นภาพรวมเบื้องต้นจากข้อสอบจำนวนจำกัด ไม่ใช่ผลรับรองระดับ CEFR</p>
      </>}
      <p>ครูเป็นผู้เริ่มแบบประเมินจาก Lobby กรุณาเข้าห้องเรียนเพื่อทำพร้อมกับคลาส</p>
      {classId && <a className="btn btn-primary" href={`/lesson/${encodeURIComponent(classId)}`}>เข้าห้อง Lobby</a>}
    </>}
  </section>;
}
