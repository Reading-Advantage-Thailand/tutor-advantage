"use client";

import { QuizPhase } from "@/components/lesson/QuizPhase";
import type { QuizQuestion, StudentScore } from "@/components/lesson/QuizPhase";

const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    text: "What does the word 'articulate' mean when used to describe a person?",
    options: [
      "Able to express ideas clearly and fluently",
      "Unable to understand spoken language",
      "Speaking much too quickly for others",
      "Writing with great difficulty",
    ],
    correctAnswer: 0,
  },
  {
    id: "q2",
    text: "Which sentence uses the Present Perfect tense correctly?",
    options: [
      "She has went to the market yesterday.",
      "She has gone to the market.",
      "She have gone to the market.",
      "She had go to the market.",
    ],
    correctAnswer: 1,
  },
  {
    id: "q3",
    text: "Choose the correct meaning of the idiom 'break the ice'.",
    options: [
      "To destroy a frozen lake or river",
      "To cause an accident on a cold day",
      "To say or do something to ease social tension",
      "To start a physical fight",
    ],
    correctAnswer: 2,
  },
  {
    id: "q4",
    text: "Which word is a synonym for 'diligent'?",
    options: ["Lazy", "Careless", "Hardworking", "Forgetful"],
    correctAnswer: 2,
  },
  {
    id: "q5",
    text: "What is the correct passive form of: 'The teacher explains the lesson'?",
    options: [
      "The lesson is explaining by the teacher.",
      "The lesson is explained by the teacher.",
      "The lesson was explained by the teacher.",
      "The lesson explained by the teacher.",
    ],
    correctAnswer: 1,
  },
  {
    id: "q6",
    text: "Which of the following is an example of a compound sentence?",
    options: [
      "She runs every morning.",
      "Although she was tired, she finished the report.",
      "She was tired, but she finished the report.",
      "Running every morning keeps her healthy.",
    ],
    correctAnswer: 2,
  },
  {
    id: "q7",
    text: "What does 'CEFR' stand for in English language learning?",
    options: [
      "Common European Framework of Reference for Languages",
      "Certified English Fluency Rating",
      "Cambridge English Fluency Requirements",
      "Central Evaluation Framework for Reading",
    ],
    correctAnswer: 0,
  },
  {
    id: "q8",
    text: "Choose the sentence with the correct subject-verb agreement.",
    options: [
      "The news are shocking everyone.",
      "Each of the students have submitted their work.",
      "The jury have reached a verdict.",
      "Mathematics is my favourite subject.",
    ],
    correctAnswer: 3,
  },
];

const STUDENTS: StudentScore[] = [
  { id: "s1", name: "สมชาย", avatarColor: "bg-violet-500", score: 0, correct: 0, total: 0 },
  { id: "s2", name: "มาลี", avatarColor: "bg-pink-500", score: 0, correct: 0, total: 0 },
  { id: "s3", name: "ปราณี", avatarColor: "bg-amber-500", score: 0, correct: 0, total: 0 },
  { id: "s4", name: "วิชัย", avatarColor: "bg-emerald-500", score: 0, correct: 0, total: 0 },
  { id: "s5", name: "กานดา", avatarColor: "bg-sky-500", score: 0, correct: 0, total: 0 },
  { id: "s6", name: "น้องนุช", avatarColor: "bg-rose-500", score: 0, correct: 0, total: 0 },
  { id: "you", name: "คุณ", avatarColor: "bg-indigo-600", score: 0, correct: 0, total: 0, isCurrentUser: true },
];

export default function QuizDemoPage() {
  return (
    <QuizPhase
      questions={QUESTIONS}
      students={STUDENTS}
      lessonTitle="Grammar & Vocabulary Quiz"
      subject="English — B1 Level"
      timePerQuestion={30}
    />
  );
}
