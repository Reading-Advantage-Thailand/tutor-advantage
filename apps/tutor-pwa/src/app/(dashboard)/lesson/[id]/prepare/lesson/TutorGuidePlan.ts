import type { ArticleData } from "../../../../../../lib/lesson-types";
import {
  GAME_PHASES,
  LESSON_PHASE,
  PHASE_NAMES,
  QUESTION_PHASES,
  RESULT_REVIEW_PHASES,
  TOTAL_LESSON_PHASES,
} from "../../../../../../lib/lessonPhases";
import type { TutorGuideStep } from "./TutorGuideOverlay";

export const TOTAL_GUIDE_PHASES = TOTAL_LESSON_PHASES;

type Focus = {
  target: string;
  title: string;
  description: string;
  tip: string;
  action?: "click" | "none";
  autoAdvance?: boolean;
  targetOptional?: boolean;
};

const focus = (
  target: string,
  title: string,
  description: string,
  tip: string,
  options: Pick<Focus, "action" | "autoAdvance" | "targetOptional"> = {},
): Focus => ({ target, title, description, tip, ...options });

const phaseGuidance: Record<number, { title: string; description: string; tip: string }> = {
  [LESSON_PHASE.LAUNCH]: {
    title: PHASE_NAMES[LESSON_PHASE.LAUNCH],
    description: "ใช้หน้าจอจริงเพื่อแนะนำบทความ ตั้งเป้าหมาย และชวนให้นักเรียนคาดเดาเรื่อง",
    tip: "เริ่มด้วยคำถามสั้น ๆ ก่อนเฉลยเนื้อหา",
  },
  [LESSON_PHASE.FLASHCARDS]: {
    title: PHASE_NAMES[LESSON_PHASE.FLASHCARDS],
    description: "ใช้ Flashcard จริงของ Lesson ให้เด็กเห็นคำศัพท์ทีละใบ ลองนึกความหมาย และฟังการออกเสียง",
    tip: "ให้เด็กลองตอบก่อนเปิดเฉลยทุกใบ",
  },
  [LESSON_PHASE.READ_ARTICLE]: {
    title: PHASE_NAMES[LESSON_PHASE.READ_ARTICLE],
    description: "ใช้บทอ่านจริงเพื่อวางจังหวะการอ่านและเลือกจุดที่ควรหยุดฟังเสียง",
    tip: "อ่านรอบแรกเพื่อจับใจความก่อนแปลทีละคำ",
  },
  [LESSON_PHASE.VOCABULARY_CONTEXT]: {
    title: PHASE_NAMES[LESSON_PHASE.VOCABULARY_CONTEXT],
    description: "ทบทวนจุดในบทอ่านที่ควรหยุดอธิบายคำศัพท์จากบริบท",
    tip: "ให้เด็กเดาความหมายจากคำรอบข้างก่อน",
  },
  [LESSON_PHASE.DEEP_READING]: {
    title: PHASE_NAMES[LESSON_PHASE.DEEP_READING],
    description: "ใช้หน้าจอจริงพานักเรียนกลับไปหาหลักฐานและรายละเอียดในบทความ",
    tip: "ถามว่า Where do you see that in the text?",
  },
  [LESSON_PHASE.KEY_SENTENCES]: {
    title: PHASE_NAMES[LESSON_PHASE.KEY_SENTENCES],
    description: "เลือกประโยคหลัก ฟังเสียง และเตรียมให้นักเรียนอ่านซ้ำพร้อมสังเกตโครงสร้าง",
    tip: "ให้เด็กอธิบายว่าประโยคนี้ช่วยสื่อใจความอย่างไร",
  },
  [LESSON_PHASE.COMPREHENSION]: {
    title: PHASE_NAMES[LESSON_PHASE.COMPREHENSION],
    description: "อ่านคำถามและตัวเลือกจาก Lesson จริง แล้วเตรียมจังหวะให้เด็กคิดก่อนเฉลย",
    tip: "เน้นเหตุผลและหลักฐาน ไม่ใช่แค่คำตอบที่ถูก",
  },
  [LESSON_PHASE.GUIDED_RESPONSE]: {
    title: PHASE_NAMES[LESSON_PHASE.GUIDED_RESPONSE],
    description: "ดูคำถามปลายเปิดและ sentence frame ที่ใช้ช่วยให้นักเรียนเรียบเรียงคำตอบ",
    tip: "เริ่มจากคำตอบสั้น ๆ แล้วค่อยต่อเหตุผล",
  },
  [LESSON_PHASE.VOCABULARY_PRACTICE]: {
    title: PHASE_NAMES[LESSON_PHASE.VOCABULARY_PRACTICE],
    description: "ทดลองดูโจทย์คำศัพท์จริงและเตรียมคำอธิบายหลังนักเรียนเลือกคำตอบ",
    tip: "ชวนเด็กยกตัวอย่างประโยคเพิ่ม",
  },
  [LESSON_PHASE.VOCABULARY_GAME]: {
    title: PHASE_NAMES[LESSON_PHASE.VOCABULARY_GAME],
    description: "ลองเปิดโหวตเกม เลือกเกม และดู Teacher Demo/Tutorial จาก component เกมจริง",
    tip: "สาธิตกติกาและวิธีตอบก่อนให้นักเรียนเล่น",
  },
  [LESSON_PHASE.SENTENCE_PRACTICE]: {
    title: PHASE_NAMES[LESSON_PHASE.SENTENCE_PRACTICE],
    description: "ใช้โจทย์เติมคำจริงเพื่อฝึกให้นักเรียนอาศัยบริบทและอ่านประโยคเต็ม",
    tip: "ให้อ่านประโยคเต็มหลังตอบทุกครั้ง",
  },
  [LESSON_PHASE.SENTENCE_ORDER]: {
    title: PHASE_NAMES[LESSON_PHASE.SENTENCE_ORDER],
    description: "ดูโจทย์เรียงคำจริงและเตรียมคำถามให้เด็กสังเกต subject, verb และคำเชื่อม",
    tip: "ให้เด็กอ่านประโยคที่เรียงแล้วออกเสียง",
  },
  [LESSON_PHASE.GUIDED_WRITING]: {
    title: PHASE_NAMES[LESSON_PHASE.GUIDED_WRITING],
    description: "ใช้ prompt และโครงคำตอบจริงเพื่อวางแผนการเขียนก่อนลงมือเขียน",
    tip: "ตรวจให้มีใจความ เหตุผล และหลักฐานจากบทเรียน",
  },
  [LESSON_PHASE.SENTENCE_GAME]: {
    title: PHASE_NAMES[LESSON_PHASE.SENTENCE_GAME],
    description: "ทดลองเปิดโหวตและสาธิตเกมประโยคจาก Lesson จริงก่อนใช้กับนักเรียน",
    tip: "ย้ำให้อ่านประโยคให้จบก่อนส่งคำตอบ",
  },
  [LESSON_PHASE.LANGUAGE_QUESTIONS]: {
    title: PHASE_NAMES[LESSON_PHASE.LANGUAGE_QUESTIONS],
    description: "เตรียมพื้นที่ให้เด็กถามเรื่องภาษาและใช้เนื้อหาบทเรียนช่วยอธิบาย",
    tip: "ขอให้เด็กยกตัวอย่างจากบทความเมื่อถามเรื่องภาษา",
  },
  [LESSON_PHASE.REFLECTION]: {
    title: PHASE_NAMES[LESSON_PHASE.REFLECTION],
    description: "ใช้คำถามสะท้อนการเรียนรู้เพื่อดูสิ่งที่เด็กเข้าใจและสิ่งที่ควรฝึกต่อ",
    tip: "เปลี่ยนคำตอบของเด็กให้เป็นเป้าหมายครั้งถัดไป",
  },
  [LESSON_PHASE.PAIR_CONVERSATION]: {
    title: PHASE_NAMES[LESSON_PHASE.PAIR_CONVERSATION],
    description: "ดูคำถามชวนคุยและแนวทางดูแลคู่สนทนาจาก Lesson จริง",
    tip: "เดินฟังแต่ละคู่และจดประโยคที่น่าสนใจ",
  },
  [LESSON_PHASE.WRAP_UP]: {
    title: PHASE_NAMES[LESSON_PHASE.WRAP_UP],
    description: "ปิดบทเรียนด้วยหน้าสรุปผลจริง และเตรียมคำพูดเพื่อชื่นชมความพยายาม",
    tip: "ใช้คะแนนเป็นข้อมูลพัฒนาการ ไม่ใช่เพื่อเปรียบเทียบเด็ก",
  },
};

function articleWords(articleData: ArticleData): any[] {
  return Array.isArray((articleData as any)?.words) ? (articleData as any).words : [];
}

function articleSentences(articleData: ArticleData): any[] {
  return Array.isArray((articleData as any)?.sentences) ? (articleData as any).sentences : [];
}

function sentenceText(sentence: any): string {
  return String(
    typeof sentence === "object"
      ? sentence?.sentences || sentence?.text || sentence?.sentence || ""
      : sentence || "",
  ).trim();
}

function hasReadingAudio(articleData: ArticleData, sentences: any[]): boolean {
  const directAudio = [
    (articleData as any)?.audio_url,
    (articleData as any)?.raAudioUrl,
    (articleData as any)?.readingAdvantageAudioUrl,
  ].some((value) => typeof value === "string" && /^https?:\/\//i.test(value));
  const sentenceAudio = sentences.some((sentence) =>
    typeof sentence === "object" && /^https?:\/\//i.test(String(sentence?.audioUrl || sentence?.audio_url || "")),
  );
  return directAudio || sentenceAudio;
}

function questionCount(articleData: ArticleData, phase: number): number {
  const questions = phase === LESSON_PHASE.COMPREHENSION
    ? (articleData as any)?.multipleChoiceQuestions
    : (articleData as any)?.shortAnswerQuestions;
  return Array.isArray(questions)
    ? questions.filter((question: any) => Boolean(String(question?.question || question || "").trim())).length
    : 0;
}

function phaseFocusGuidance(): Record<number, Focus[]> {
  return {
    [LESSON_PHASE.LAUNCH]: [
      focus("phase-1-overview", "ภาพรวมบทเรียน", "ดูชื่อเรื่อง ระดับภาษา และภาพรวมของบทเรียนจริงก่อนเริ่มสอน", "ใช้ส่วนนี้ชวนให้นักเรียนเดาเรื่องจากภาพและชื่อเรื่อง"),
      focus("phase-1-checklist", "Checklist เปิดบทเรียน", "ส่วนนี้คือสิ่งที่ติวเตอร์ควรทำในช่วงเริ่มต้น: แนะนำเรื่อง ตั้งเป้าหมาย และชวนคิด", "เลือกทำทีละข้อ ไม่ต้องอ่านทุกข้อความบนจอให้นักเรียนฟัง"),
    ],
    [LESSON_PHASE.FLASHCARDS]: [
      focus("phase-2-flashcards", "รู้จักหน้าบัตรคำศัพท์", "นี่คือ Flashcard จริงของ Lesson ใช้สำหรับให้เด็กเห็นคำศัพท์ทีละใบและลองนึกความหมายด้วยตัวเอง", "เริ่มจากให้เด็กอ่านคำศัพท์บนหน้าใบการ์ดก่อน"),
      focus("phase-2-flashcard-card", "กดที่การ์ดเพื่อพลิกดู", "คลิกที่ตัวการ์ดเพื่อสลับระหว่างหน้าคำศัพท์และหน้าความหมายได้ทันที", "ให้เด็กลองตอบความหมายก่อน แล้วค่อยพลิกการ์ดดูเฉลย", { action: "click", autoAdvance: true }),
      focus("phase-2-flashcard-audio", "ฟังการออกเสียงคำศัพท์", "กดลำโพงบน Flashcard เพื่อเปิดเสียงคำศัพท์หรือใช้เสียงสำรองของเบราว์เซอร์เมื่อบทความไม่มีไฟล์เสียง", "ให้เด็กฟังแล้วอ่านตาม", { action: "click", autoAdvance: true }),
      focus("phase-2-flashcard-reveal", "เปิดเฉลยหรือกลับไปดูคำศัพท์", "ปุ่มนี้ทำงานเหมือนการพลิกการ์ด ใช้เปิดคำแปลหลังจากให้นักเรียนลองตอบแล้ว หรือกลับไปดูคำศัพท์อีกครั้ง", "อย่าเปิดเฉลยทันที ให้เว้นเวลาคิดสั้น ๆ ก่อน", { action: "click", autoAdvance: true }),
      focus("phase-2-flashcard-progress", "ดูความคืบหน้าของ Flashcard", "แถบนี้บอกว่ากำลังอยู่การ์ดใบที่เท่าไร และทำไปแล้วกี่เปอร์เซ็นต์ของชุดคำศัพท์", "ใช้บอกนักเรียนว่าตอนนี้อยู่ช่วงไหนของภารกิจ"),
      focus("phase-2-flashcard-next", "ไปการ์ดใบถัดไป", "กดปุ่ม ถัดไป เพื่อเปลี่ยนเป็นคำศัพท์ใบใหม่ ระบบจะกลับไปแสดงหน้าคำศัพท์ให้อัตโนมัติ", "ให้เด็กอ่านคำใหม่ ออกเสียง และเดาความหมายก่อนเปิดเฉลยอีกครั้ง", { action: "click", autoAdvance: true }),
    ],
    [LESSON_PHASE.READ_ARTICLE]: [
      focus("phase-3-reading-passage", "บทอ่านจริง", "นี่คือพื้นที่ที่นักเรียนอ่านตามและกดเลือกประโยคเพื่อโฟกัสระหว่างการอ่าน", "สาธิตการอ่านหนึ่งย่อหน้า แล้วค่อยให้นักเรียนอ่านต่อ"),
      focus("phase-3-first-sentence", "เลือกประโยคเพื่อโฟกัส", "คลิกประโยคแรกเพื่อเลือกช่วงที่ต้องการอ่านซ้ำหรืออธิบายเป็นพิเศษ", "ใช้การเลือกประโยคเพื่อหยุดถามความเข้าใจระหว่างอ่าน", { action: "click", autoAdvance: true }),
      focus("phase-3-audio-player", "แผงเสียงอ่านบทความ", "แผงนี้ใช้ควบคุมเสียง เล่นย้อนหลัง ข้ามประโยค และดูตำแหน่งการอ่าน", "สังเกตว่าแผงควบคุมจะลอยอยู่ด้านล่างของ Lesson"),
      focus("phase-3-play-button", "เริ่มเสียงอ่าน", "กดปุ่มเล่นเพื่อให้นักเรียนฟังจังหวะและการออกเสียงจากบทอ่านจริง", "หยุดเป็นช่วง ๆ เพื่อให้เด็กอ่านตาม", { action: "click", autoAdvance: true }),
      focus("phase-3-speed", "ปรับความเร็วเสียง", "กดปุ่มความเร็วเพื่อสลับจังหวะการอ่านให้เหมาะกับระดับของนักเรียน", "เริ่มช้าก่อน แล้วค่อยเพิ่มความเร็วเมื่อเด็กตามทัน", { action: "click", autoAdvance: true }),
      focus("phase-3-previous-sentence", "ย้อนกลับหนึ่งประโยค", "ปุ่มนี้ใช้กลับไปฟังประโยคก่อนหน้าเมื่อเด็กต้องการทบทวน", "ปุ่มอาจยัง disabled ในประโยคแรก จึงเป็นตัวควบคุมสำหรับใช้ระหว่างสอน", { targetOptional: true }),
      focus("phase-3-next-sentence", "ไปประโยคถัดไป", "ปุ่มนี้ใช้ข้ามไปยังประโยคถัดไปโดยไม่ต้องเลื่อนหาเอง", "ใช้เมื่อเด็กพร้อมอ่านต่อหรืออยากข้ามช่วงที่เข้าใจแล้ว", { action: "click", autoAdvance: true }),
      focus("phase-3-previous-part", "ย้อนกลับ Part", "สำหรับบทความ Primary ให้ใช้ปุ่มนี้กลับไปยังภาพหรือส่วนก่อนหน้า", "ใช้เชื่อมภาพกับรายละเอียดในบทอ่าน", { targetOptional: true }),
      focus("phase-3-next-part", "ไป Part ถัดไป", "สำหรับบทความ Primary ให้ใช้ปุ่มนี้เปลี่ยนไปยังภาพหรือส่วนถัดไป", "หยุดถามใจความสั้น ๆ ทุกครั้งที่เปลี่ยน Part", { action: "click", autoAdvance: true, targetOptional: true }),
    ],
    [LESSON_PHASE.VOCABULARY_CONTEXT]: [
      focus("phase-4-passage", "คำศัพท์ในบริบท", "ดูคำศัพท์ที่ถูกไฮไลต์อยู่ในบทอ่าน เพื่ออธิบายความหมายจากประโยครอบข้าง", "ถามให้เด็กเดาความหมายก่อนเปิดคำแปล"),
      focus("phase-4-vocabulary", "Vocabulary List สำหรับทบทวน", "ใช้รายการนี้เทียบคำศัพท์กับความหมาย ชนิดของคำ และคำแปลภาษาไทย", "เลือกคำที่เด็กยังสับสนมาทบทวนซ้ำ"),
      focus("phase-4-first-audio", "ฟังเสียงคำศัพท์ในบริบท", "กดลำโพงของคำแรกเพื่อฟังเสียงจากรายการคำศัพท์จริง", "ให้เด็กออกเสียงตาม แล้วกลับไปชี้คำในบทอ่าน", { action: "click", autoAdvance: true }),
    ],
    [LESSON_PHASE.DEEP_READING]: [
      focus("phase-5-passage", "อ่านเพื่อหาหลักฐาน", "ใช้บทอ่านจริงเป็นหลักฐานประกอบคำตอบ ไม่ใช่เดาจากความรู้สึกอย่างเดียว", "ชวนถามว่า Where do you see that in the text?"),
      focus("phase-5-questions", "Comprehension Guide", "นี่คือชุดคำถามที่ใช้พานักเรียนกลับไปค้นหาคำตอบจากบทอ่าน", "ให้เด็กชี้หรืออธิบายประโยคที่เป็นหลักฐาน"),
      focus("phase-5-first-question", "คำถามข้อแรก", "กดดูคำถามทีละข้อและเตรียมจังหวะให้นักเรียนคิดก่อนช่วยอธิบาย", "ใช้ปุ่มเสียงเมื่ออยากให้นักเรียนฟังคำถามซ้ำ"),
      focus("phase-5-first-question-audio", "ฟังคำถามข้อแรก", "กดลำโพงของคำถามข้อแรกเพื่อฟังการออกเสียงจาก Lesson จริง", "ใช้เสียงซ้ำเมื่อคำถามยาวหรือมีคำศัพท์ใหม่", { action: "click", autoAdvance: true }),
    ],
    [LESSON_PHASE.KEY_SENTENCES]: [
      focus("phase-6-sentences", "Key Sentences", "เลือกประโยคสำคัญจากบทเรียนเพื่อฝึกอ่าน โครงสร้าง และคำศัพท์ที่ไฮไลต์", "เริ่มจากประโยคที่สั้นและมีคำศัพท์เป้าหมาย"),
      focus("phase-6-first-audio", "ฟังประโยคตัวอย่าง", "กดลำโพงของประโยคแรกเพื่อฟังจังหวะการอ่านจาก Lesson จริง", "ให้นักเรียนอ่านตาม แล้วถามว่าประโยคนี้สื่อความหมายอย่างไร", { action: "click", autoAdvance: true }),
      focus("phase-6-article", "ย้อนดูประโยคในบทอ่าน", "ใช้ส่วนนี้เชื่อมประโยคสำคัญกลับไปยังบริบทของเรื่อง", "ชี้คำศัพท์หรือโครงสร้างที่ต้องการให้เด็กสังเกต"),
    ],
    [LESSON_PHASE.COMPREHENSION]: [
      focus("phase-7-question", "คำถามตรวจความเข้าใจ", "อ่านคำถามจาก Lesson จริงและเตรียมให้นักเรียนคิดก่อนเห็นตัวเลือก", "ถามเหตุผลประกอบคำตอบเสมอ"),
      focus("phase-7-question-audio", "เสียงอ่านคำถาม", "กดลำโพงเพื่อฟังคำถาม แล้วใช้เป็นตัวอย่างการอ่านออกเสียง", "เหมาะสำหรับคำถามยาวหรือคำที่นักเรียนยังไม่คุ้น", { action: "click", autoAdvance: true }),
      focus("phase-7-options", "ตัวเลือกคำตอบ", "ดูรูปแบบตัวเลือกและเตรียมชวนเด็กเปรียบเทียบหลักฐานของแต่ละข้อ", "ให้เด็กอธิบายว่าทำไมตัวเลือกอื่นจึงไม่ใช่"),
    ],
    [LESSON_PHASE.GUIDED_RESPONSE]: [
      focus("phase-8-question", "คำถามปลายเปิด", "ดูคำถามที่ให้นักเรียนเรียบเรียงคำตอบด้วยภาษาของตัวเอง", "เริ่มจากคำตอบสั้น ๆ แล้วค่อยขอเหตุผลเพิ่ม"),
      focus("phase-8-question-audio", "เสียงอ่านคำถามปลายเปิด", "กดลำโพงเพื่อฟังคำถามและเตรียมสาธิตการจับใจความก่อนตอบ", "หยุดหลังคำสำคัญเพื่อให้นักเรียนทวนคำถาม", { action: "click", autoAdvance: true }),
    ],
    [LESSON_PHASE.VOCABULARY_PRACTICE]: [
      focus("phase-9-question", "โจทย์คำศัพท์", "ดูรูปแบบคำถามที่ให้นักเรียนเลือกความหมายของคำศัพท์จากบทเรียน", "ให้เด็กลองนึกความหมายเองก่อนอ่านข้อความตัวเลือก"),
      focus("phase-9-options", "ตัวเลือกความหมาย", "เปรียบเทียบความหมายของตัวเลือกและเตรียมอธิบายคำตอบหลังเด็กเลือก", "ยกตัวอย่างประโยคเพิ่มเมื่อคำศัพท์มีหลายความหมาย"),
    ],
    [LESSON_PHASE.VOCABULARY_GAME]: [
      focus("phase-10-game", "เกมคำศัพท์", "สำรวจพื้นที่เกมจริง ซึ่งจะเปลี่ยนจากโหวตเป็นหน้าพร้อมเริ่ม Demo, Tutorial และเกม", "ติวเตอร์ควรสาธิตกติกาและวิธีตอบก่อนให้นักเรียนเริ่มเล่น"),
    ],
    [LESSON_PHASE.SENTENCE_PRACTICE]: [
      focus("phase-11-question", "เติมคำในประโยค", "ดูประโยคจริงและช่องว่างที่ให้นักเรียนใช้บริบทช่วยเลือกคำ", "ให้นักเรียนอ่านประโยคเต็มหลังเฉลยทุกครั้ง"),
      focus("phase-11-question-audio", "ฟังโจทย์เติมคำ", "กดลำโพงเพื่อฟังประโยคและจับคำที่เป็นกุญแจของโจทย์", "ชี้ให้เด็กฟังคำก่อนและหลังช่องว่าง", { action: "click", autoAdvance: true }),
      focus("phase-11-options", "ตัวเลือกเติมคำ", "ดูตัวเลือกและเตรียมให้เด็กอธิบายว่าคำไหนเข้ากับความหมายและไวยากรณ์", "เน้นทั้งความหมายและรูปประโยค"),
    ],
    [LESSON_PHASE.SENTENCE_ORDER]: [
      focus("phase-12-question", "เรียงประโยค", "ดูโจทย์ที่ให้นักเรียนจัดลำดับคำให้เป็นประโยคที่ถูกต้อง", "ให้เด็กหา subject และ verb ก่อนเรียงทั้งหมด"),
      focus("phase-12-question-audio", "ฟังโจทย์เรียงประโยค", "กดลำโพงเพื่อฟังโจทย์และเตรียมอ่านประโยคที่เรียงแล้ว", "หลังจัดเรียงเสร็จ ให้เด็กอ่านออกเสียงทั้งประโยค", { action: "click", autoAdvance: true }),
      focus("phase-12-options", "คำสำหรับจัดเรียง", "ดูชุดคำที่นักเรียนต้องใช้สร้างประโยค และเตรียมอธิบายตัวเชื่อม", "ถามเหตุผลของตำแหน่งคำ ไม่ใช่ให้เดาตามรูปแบบอย่างเดียว"),
    ],
    [LESSON_PHASE.GUIDED_WRITING]: [
      focus("phase-13-writing", "Guided Writing", "ดู prompt และโครงคำตอบที่ช่วยให้นักเรียนวางแผนการเขียนก่อนลงมือจริง", "ชวนเด็กพูดไอเดียออกมาก่อน แล้วค่อยเขียนเป็นประโยค"),
      focus("phase-13-question-audio", "ฟัง Writing Prompt", "กดลำโพงเพื่อฟังโจทย์การเขียนและเตรียมเน้นคำสั่งสำคัญ", "ตรวจว่าคำตอบมีเหตุผลและเชื่อมกับบทเรียน", { action: "click", autoAdvance: true }),
    ],
    [LESSON_PHASE.SENTENCE_GAME]: [
      focus("phase-14-game", "เกมประโยค", "สำรวจพื้นที่เกมจริง ซึ่งจะเปลี่ยนจากโหวตเป็นหน้าพร้อมเริ่ม Demo, Tutorial และเกม", "สาธิตวิธีอ่านประโยคหลังจบแต่ละรอบ"),
    ],
    [LESSON_PHASE.LANGUAGE_QUESTIONS]: [
      focus("phase-15-question-list", "Language Questions", "ดูพื้นที่รวมคำถามภาษาที่นักเรียนสงสัย และคำตอบแนะนำจาก Lesson", "ใช้คำถามของนักเรียนเป็นโอกาสทบทวน grammar หรือ vocabulary"),
      focus("phase-15-first-question", "อ่านคำถามของนักเรียน", "อ่านคำถามแต่ละรายเพื่อจับจุดที่นักเรียนสงสัยจริงก่อนเริ่มอธิบาย", "ชวนให้เจ้าของคำถามยกตัวอย่างจากบทความ"),
      focus("phase-15-ai-answer", "อ่านคำตอบแนะนำ", "ดูคำตอบแนะนำรายข้อเพื่อใช้เป็นแนวทางอธิบาย ไม่ใช่แทนการถามต่อกับนักเรียน", "ปรับคำอธิบายให้เหมาะกับระดับของห้อง"),
    ],
    [LESSON_PHASE.REFLECTION]: [
      focus("phase-16-reflection", "Reflection", "ใช้คำถามสะท้อนการเรียนรู้เพื่อดูว่านักเรียนเข้าใจอะไรและยังต้องฝึกอะไรต่อ", "เปลี่ยนคำตอบให้เป็นเป้าหมายสำหรับครั้งถัดไป"),
    ],
    [LESSON_PHASE.PAIR_CONVERSATION]: [
      focus("phase-17-pairs", "Pair Roster", "ดูรายชื่อคู่ที่ระบบจัดไว้เพื่อรู้ว่าใครกำลังสนทนากับใครและติดตามการมีส่วนร่วมได้", "เดินดูให้ทุกคู่มีสมาชิกและสลับบทบาทกันพูด"),
      focus("phase-17-starters", "คำถามเริ่มบทสนทนา", "เลือกคำถามชวนคุยเพื่อให้นักเรียนจับคู่พูดคุยเกี่ยวกับเรื่องและคำศัพท์", "เดินฟังแต่ละคู่และจดประโยคที่ควรนำมา feedback"),
      focus("phase-17-tutor-actions", "Tutor Actions", "ใช้รายการนี้เป็น checklist ระหว่าง monitoring: ฟัง ถามต่อ และเก็บตัวอย่างประโยคมา feedback", "อย่าเฉลยแทนคู่สนทนา ให้ถามต่อเพื่อขยายคำตอบ"),
    ],
    [LESSON_PHASE.WRAP_UP]: [
      focus("phase-18-summary", "สรุปผลบทเรียน", "ดูหน้าสรุปผลและใช้ข้อมูลเพื่อชื่นชมความพยายาม พร้อมปิดบทเรียนอย่างมีเป้าหมาย", "ใช้คะแนนเป็นข้อมูลพัฒนา ไม่ใช่การเปรียบเทียบนักเรียน"),
    ],
  };
}

function phaseHasData(articleData: ArticleData, phase: number): boolean {
  const words = articleWords(articleData);
  const sentences = articleSentences(articleData);
  if (phase === LESSON_PHASE.FLASHCARDS) return words.length > 0;
  if (phase === LESSON_PHASE.COMPREHENSION) return questionCount(articleData, phase) > 0;
  if (phase === LESSON_PHASE.VOCABULARY_PRACTICE) return words.length >= 4;
  if (([LESSON_PHASE.SENTENCE_PRACTICE, LESSON_PHASE.SENTENCE_ORDER] as number[]).includes(phase)) {
    return sentences.some((sentence) => sentenceText(sentence).split(/\s+/).filter(Boolean).length >= 3);
  }
  return questionCount(articleData, phase) > 0;
}

function resolveFocusTarget(articleData: ArticleData, phase: number, current: Focus): Focus {
  const words = articleWords(articleData);
  const sentences = articleSentences(articleData);
  const hasShortAnswer = questionCount(articleData, phase) > 0;
  const hasReading = hasReadingAudio(articleData, sentences);
  const hasPrimaryParts = Boolean((articleData as any)?.primaryParts?.length || (articleData as any)?.parts?.length);
  const fallback = (target: string, title: string, description: string): Focus => ({
    ...current,
    target,
    title,
    description,
    tip: current.tip,
    action: "none",
    autoAdvance: false,
    targetOptional: true,
  });

  if (phase === LESSON_PHASE.FLASHCARDS && !words.length) {
    return fallback("phase-2-flashcards", "ไม่มีคำศัพท์สำหรับ Flashcard", "บทความนี้ไม่มีคำศัพท์ จึงใช้พื้นที่ Flashcard เป็นจุดอธิบายแทน");
  }
  if (phase === LESSON_PHASE.FLASHCARDS && current.target === "phase-2-flashcard-next" && words.length <= 1) {
    return fallback("phase-2-flashcard-progress", "กรณีมี Flashcard ใบเดียว", "เมื่อมีการ์ดใบเดียว ปุ่ม ถัดไป จะ disabled อยู่แล้ว ให้สอนการพลิกและเปิดเฉลยแทน");
  }
  if (phase === LESSON_PHASE.READ_ARTICLE && !hasReading && current.action === "click") {
    return fallback("phase-3-reading-passage", "บทความไม่มีเสียงอ่าน", "ไม่มีไฟล์เสียงในบทความนี้ ให้สอนการอ่านจาก passage แทน");
  }
  if (phase === LESSON_PHASE.VOCABULARY_CONTEXT && !words.length && current.action === "click") {
    return fallback("phase-4-vocabulary", "ไม่มีรายการคำศัพท์", "บทความนี้ไม่มีคำศัพท์ ให้ใช้ passage อธิบายบริบทแทน");
  }
  if (phase === LESSON_PHASE.READ_ARTICLE && current.target === "phase-3-next-sentence" && sentences.filter(sentenceText).length <= 1) {
    return fallback(hasReading ? "phase-3-audio-player" : "phase-3-reading-passage", "ไม่มีช่วงถัดไปให้กด", "บทความนี้มีเพียงช่วงเดียว ปุ่มถัดไปจึง disabled อยู่แล้ว");
  }
  if (phase === LESSON_PHASE.READ_ARTICLE && (current.target === "phase-3-previous-part" || current.target === "phase-3-next-part") && !hasPrimaryParts) {
    return fallback("phase-3-reading-passage", "บทอ่านแบบหน้าเดียว", "บทความนี้ไม่มีการแบ่ง Part แบบ Primary จึงใช้บทอ่านหน้าเดียวแทน");
  }
  if (phase === LESSON_PHASE.DEEP_READING && current.target.startsWith("phase-5-first-question") && !hasShortAnswer) {
    return fallback("phase-5-questions", "ไม่มีคำถามเชิงลึกในบทความนี้", "บทความนี้ไม่มีคำถาม short answer จึงใช้พื้นที่ Comprehension เป็น fallback ได้");
  }
  if (phase === LESSON_PHASE.KEY_SENTENCES && current.target === "phase-6-first-audio" && !sentences.some(sentenceText)) {
    return fallback("phase-6-sentences", "ไม่มี Key Sentence ในบทความนี้", "ไม่มี sentence data ให้เลือกเสียง จึงใช้พื้นที่ Key Sentences เป็นจุดอธิบายแทน");
  }
  if (([
    LESSON_PHASE.COMPREHENSION,
    LESSON_PHASE.VOCABULARY_PRACTICE,
    LESSON_PHASE.SENTENCE_PRACTICE,
    LESSON_PHASE.SENTENCE_ORDER,
    LESSON_PHASE.GUIDED_WRITING,
  ] as number[]).includes(phase) && !phaseHasData(articleData, phase)) {
    return fallback("phase-content", "โจทย์ของ Phase นี้ยังไม่พร้อม", "บทความนี้ไม่มีข้อมูลพอสำหรับสร้างโจทย์ จึงใช้คำอธิบายของ Phase แทน");
  }
  if (phase === LESSON_PHASE.GUIDED_RESPONSE && !hasShortAnswer && current.target.startsWith("phase-8-question")) {
    return fallback("phase-content", "ไม่มีคำถามปลายเปิด", "บทความนี้ไม่มี short-answer question จึงสอน flow จากคำอธิบายแทน");
  }
  if (phase === LESSON_PHASE.GUIDED_WRITING && current.target === "phase-13-question-audio" && !hasShortAnswer) {
    return fallback("phase-13-writing", "ไม่มี Writing Prompt เสียงอ่าน", "ไม่มีคำถามสำหรับเสียง prompt จึงใช้การ์ด Writing อธิบายขั้นตอนแทน");
  }
  return current;
}

const phaseStep = (phase: number, step: Omit<TutorGuideStep, "phase">): TutorGuideStep => ({
  ...step,
  phase: phase - 1,
});

export function buildTutorGuideSteps(articleData: ArticleData): TutorGuideStep[] {
  const focusByPhase = phaseFocusGuidance();
  const steps: TutorGuideStep[] = [
    phaseStep(LESSON_PHASE.LAUNCH, {
      target: "lesson-control-panel",
      title: "รู้จักแผงควบคุม Lesson",
      description: "แผงนี้ใช้ดู Phase ปัจจุบัน เปิด Full screen ซ่อนแถบควบคุม และกดไปยังช่วงถัดไปของบทเรียน",
      tip: "ในห้องจริง แผงนี้คือจุดควบคุมการสอนทั้งหมดของติวเตอร์",
      action: "none",
    }),
    phaseStep(LESSON_PHASE.LAUNCH, {
      target: "fullscreen-button",
      title: "เปิด Full screen",
      description: "กดปุ่ม Full screen เพื่อขยาย Lesson ให้เต็มพื้นที่ เหมาะสำหรับแชร์หน้าจอหรือสอนบนจอใหญ่",
      tip: "หลังเปิดแล้ว ให้สังเกตแถบควบคุมที่ลอยอยู่ด้านล่างของหน้าจอ",
      action: "click",
      autoAdvance: true,
    }),
  ];

  for (let phase = 1; phase <= TOTAL_GUIDE_PHASES; phase += 1) {
    const guidance = phaseGuidance[phase];
    steps.push(phaseStep(phase, {
      target: "phase-progress",
      title: `Phase ${phase}: ${guidance.title}`,
      description: "ดูแถบความคืบหน้าด้านบนเพื่อรู้ว่ากำลังอยู่ช่วงไหนของแผนการสอน",
      tip: "ในห้องเรียนจริง แถบนี้ช่วยให้ติวเตอร์เตรียมจังหวะและเวลาของแต่ละช่วง",
      action: "none",
    }));

    for (const rawFocus of focusByPhase[phase] || []) {
      const resolved = resolveFocusTarget(articleData, phase, rawFocus);
      steps.push(phaseStep(phase, { ...resolved, action: resolved.action || "none" }));
    }

    if (GAME_PHASES.includes(phase)) {
      steps.push(phaseStep(phase, {
        target: "game-vote-options",
        title: "รอผลโหวตจากนักเรียน",
        description: "ดูตัวเลือกเกมและจำนวนโหวตที่ทยอยเข้ามา เมื่อ Mock นักเรียนโหวตครบแล้วจึงค่อยปิดโหวตจากแผงควบคุม Lesson",
        tip: "รอให้จำนวนโหวตครบก่อนปิดโหวต เพื่อให้เหมือนห้องเรียนจริง",
        action: "none",
        waitForMockVotes: true,
      }));
      steps.push(phaseStep(phase, {
        target: "game-primary-button",
        title: "ปิดโหวตและเปิดหน้าพร้อมเริ่ม",
        description: "กดปุ่มหลักเพื่อจบโหวต จากนั้น Lesson จะพาไปหน้า Ready ให้เลือกว่าจะสาธิตหรือแสดง Tutorial",
        tip: "ตรวจผลโหวตก่อนกดปิดโหวต",
        action: "click",
        autoAdvance: true,
      }));
      steps.push(phaseStep(phase, {
        target: "game-ready-panel",
        title: "เตรียมก่อนเริ่มเกม",
        description: "หน้านี้คือจุดตัดสินใจว่าจะให้ครูสาธิตและเปิด Tutorial ก่อนเริ่มเกมหรือไม่",
        tip: "เลือกให้ตรงกับเวลาที่เหลือและความคุ้นเคยของนักเรียน",
        action: "none",
      }));
      steps.push(phaseStep(phase, {
        target: "game-teacher-demo-toggle",
        title: "เปิด Teacher Demo",
        description: "เปิดตัวเลือกนี้เพื่อให้ครูเล่นให้เด็กดูหนึ่งรอบก่อนเริ่มเกมจริง",
        tip: "พูดออกเสียงวิธีคิดระหว่างสาธิต ไม่ใช่แค่กดคำตอบ",
        action: "click",
        autoAdvance: true,
      }));
      steps.push(phaseStep(phase, {
        target: "game-tutorial-toggle",
        title: "ตรวจ Tutorial",
        description: "ตรวจว่าตัวเลือก Tutorial เปิดอยู่ เพื่อให้เด็กเห็นวิธีเล่นก่อนเข้าสู่เกม",
        tip: "ถ้าห้องคุ้นเกมแล้วจึงค่อยปิดตัวเลือกนี้ได้",
        action: "none",
      }));
      steps.push(phaseStep(phase, {
        target: "game-primary-button",
        title: "เริ่ม Teacher Demo",
        description: "กดปุ่มหลักเพื่อเปิดเกมในโหมด Teacher Demo และดู surface เดียวกับที่ Tutor จะใช้สาธิตจริง",
        tip: "อธิบายกติกาและเหตุผลของคำตอบไปพร้อมกับการเล่น",
        action: "click",
        autoAdvance: true,
      }));
      steps.push(phaseStep(phase, {
        target: `phase-${phase}-teacher-demo`,
        title: "สาธิตเกมให้เด็กดู",
        description: "นี่คือหน้าจอ Teacher Demo จริงของเกมที่เลือก ใช้สาธิตวิธีเล่นและจังหวะการตอบ",
        tip: "ทำให้เด็กเห็นทั้งกติกา การเลือกคำตอบ และสิ่งที่ควรสังเกต",
        action: "none",
      }));
      steps.push(phaseStep(phase, {
        target: "game-primary-button",
        title: "ไป Tutorial",
        description: "กดเพื่อจบการสาธิตและแสดง Tutorial ให้เด็กเห็นขั้นตอนการเล่น",
        tip: "หยุดสั้น ๆ ให้เด็กถามก่อนเริ่ม Tutorial",
        action: "click",
        autoAdvance: true,
      }));
      steps.push(phaseStep(phase, {
        target: `phase-${phase}-tutorial`,
        title: "อ่าน Tutorial",
        description: "ดู Tutorial จริงของเกม แล้วชี้ให้เห็นลำดับการเล่นที่นักเรียนต้องทำบนมือถือ",
        tip: "ตรวจว่าทุกคนเข้าใจวิธีเริ่มและวิธีส่งคำตอบ",
        action: "none",
      }));
      steps.push(phaseStep(phase, {
        target: "game-primary-button",
        title: "เริ่มเกมจริง",
        description: "กดปุ่มหลักเพื่อออกจาก Tutorial และเริ่มเกมให้นักเรียนเล่นจริง",
        tip: "ก่อนกดเริ่ม ให้เช็กว่านักเรียนพร้อมและมีเวลาเพียงพอ",
        action: "click",
        autoAdvance: true,
      }));
      steps.push(phaseStep(phase, {
        target: "game-results-summary",
        title: "ติดตาม LIVE Monitoring",
        description: "ดูนักเรียนเล่นจบทีละคนจากหน้าจอ monitoring ก่อน Lesson จะเปิดผลลัพธ์ครบทุกคน",
        tip: "สังเกตคนที่ยังไม่ส่งเพื่อเตรียมช่วยเหลือโดยไม่รบกวนคนอื่น",
        action: "none",
        waitForGameResults: true,
      }));
      steps.push(phaseStep(phase, {
        target: "game-results-summary",
        title: "อ่านผลลัพธ์เกม",
        description: "เมื่อทุกคนส่งแล้ว ให้ดูอันดับ คะแนน และจำนวนข้อถูกเพื่อใช้ feedback ต่อทันที",
        tip: "ชวนเด็กอธิบายวิธีคิด ไม่เน้นเฉพาะผู้ชนะ",
        action: "none",
      }));
    } else if (phase === LESSON_PHASE.FLASHCARDS) {
      steps.push(phaseStep(phase, {
        target: "phase-2-student-status",
        title: "รอนักเรียนทบทวนคำศัพท์",
        description: "ดูสถานะนักเรียนที่กำลังเปิดการ์ดและทบทวนคำศัพท์บนมือถือ",
        tip: "ใช้ช่วงนี้ถามให้นักเรียนลองเรียกคืนความหมายก่อนเปิดเฉลย",
        action: "none",
        waitForMockAnswers: true,
      }));
    } else if (QUESTION_PHASES.includes(phase)) {
      steps.push(phaseStep(phase, {
        target: `phase-${phase}-student-status`,
        title: "รอนักเรียนตอบทีละคน",
        description: "ดูจำนวนผู้เรียนที่ตอบแล้วและสถานะ LIVE ก่อนเปิดหน้าสรุปผล",
        tip: "ใช้ช่วงนี้เดินดูห้องและช่วยเฉพาะคนที่ติดขัด โดยยังไม่เฉลย",
        action: "none",
        waitForMockAnswers: true,
      }));
      steps.push(phaseStep(phase, {
        target: "preparation-end-question-button",
        title: "กดจบคำถามด้วยตัวเอง",
        description: "เมื่อเห็นว่านักเรียนตอบเกือบครบแล้ว Tutor ต้องกดปุ่มนี้เพื่อปิดช่วงรับคำตอบและเปิดผลลัพธ์",
        tip: "ในห้องจริงควรแจ้งเด็กก่อนกดจบคำถาม เพื่อไม่ให้คนที่กำลังพิมพ์ตกหล่น",
        action: "click",
        autoAdvance: true,
      }));
      const hasData = phaseHasData(articleData, phase);
      const resultTarget = RESULT_REVIEW_PHASES.includes(phase) && hasData
        ? `phase-${phase}-results`
        : RESULT_REVIEW_PHASES.includes(phase)
          ? "phase-content"
          : phase === LESSON_PHASE.LANGUAGE_QUESTIONS
            ? "phase-15-ai-answer"
            : phase === LESSON_PHASE.REFLECTION
              ? "phase-16-responses"
              : "phase-content";
      steps.push(phaseStep(phase, {
        target: resultTarget,
        title: "อ่านผลลัพธ์และคำตอบ",
        description: "หลัง Tutor กดจบคำถาม ให้ดูคำตอบรายคนหรือสรุปผล แล้วชวนวิเคราะห์เหตุผลร่วมกัน",
        tip: "อย่ารีบข้ามผลลัพธ์ ให้ใช้เป็นจุด feedback ก่อนเปลี่ยน Phase",
        action: "none",
        targetOptional: true,
      }));
    } else if (phase !== TOTAL_GUIDE_PHASES) {
      steps.push(phaseStep(phase, {
        target: "phase-content",
        title: `ทบทวนการใช้งาน Phase ${phase}`,
        description: `ตรวจว่าหน้าจอ Phase ${phase} พร้อมใช้งานจริง และเตรียมคำอธิบายก่อนเดินหน้าต่อ`,
        tip: guidance.tip,
        action: "none",
      }));
    }

    if (phase === TOTAL_GUIDE_PHASES) {
      steps.push(phaseStep(phase, {
        target: "preparation-exit-button",
        title: "จบการเตรียมสอน",
        description: "เมื่อดูผลสรุปครบแล้ว กดปุ่ม Finish เพื่อกลับไปหน้าคลาส",
        tip: "สรุปสิ่งที่ต้องเตรียมก่อนเริ่ม Live Lesson จริงอีกครั้ง",
        action: "click",
        autoAdvance: true,
      }));
    } else {
      steps.push(phaseStep(phase, {
        target: "phase-next-button",
        title: `ไป Phase ${phase + 1}`,
        description: `กดปุ่มถัดไปของ Lesson จริงเพื่อไปยัง Phase ${phase + 1}`,
        tip: "เปลี่ยน Phase เมื่ออธิบาย control สำคัญและผลลัพธ์ของช่วงนี้ครบแล้ว",
        action: "click",
        autoAdvance: true,
      }));
    }
  }

  return steps;
}
