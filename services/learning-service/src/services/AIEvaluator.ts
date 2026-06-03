import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Zod schema for evaluation result
const EvaluationSchema = z.object({
  score: z.number().describe('คะแนน 0-5 ขึ้นอยู่กับความถูกต้องและครบถ้วนของคำตอบ'),
  feedback: z.string().describe('ข้อเสนอแนะเป็นภาษาไทย อธิบายว่าตอบถูกไหม ขาดอะไรไปบ้าง หรือชมเชย')
});

export const evaluateShortAnswer = async (
  question: string,
  expectedAnswer: string,
  studentAnswer: string
): Promise<{ score: number; feedback: string }> => {
  try {
    const prompt = `
    คุณเป็นคุณครูสอนภาษาอังกฤษที่ใจดีและให้คำแนะนำที่เป็นประโยชน์
    โจทย์: ${question}
    เฉลยที่คาดหวัง: ${expectedAnswer}
    คำตอบของนักเรียน: ${studentAnswer}

    จงตรวจคำตอบของนักเรียน ให้คะแนน 0-5 และเขียนคำอธิบายสั้นๆ (feedback) เป็นภาษาไทย
    `;

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: EvaluationSchema as any,
      prompt: prompt,
    });

    return result.object as { score: number; feedback: string };
  } catch (error) {
    console.error("AI Evaluation failed, using fallback:", error);
    // Fallback: Give full score to allow student to proceed, but with a note
    return {
      score: 5,
      feedback: "ส่งคำตอบสำเร็จ! (ระบบตรวจอัตโนมัติขัดข้องชั่วคราว คุณครูจะตรวจซ้ำอีกครั้ง)"
    };
  }
};

// Schema for Guided Writing feedback (Step 11)
const WritingSchema = z.object({
  score: z.number().describe('คะแนน 0-5 ตามความครบถ้วน การใช้ภาษา และการอ้างอิงบทความ'),
  feedback: z.string().describe('ข้อเสนอแนะการเขียนเป็นภาษาไทย ชมจุดเด่นและแนะนำสิ่งที่ควรปรับ')
});

export const evaluateWriting = async (
  prompt: string,
  draft: string,
): Promise<{ score: number; feedback: string }> => {
  try {
    const aiPrompt = `
    คุณเป็นคุณครูสอนเขียนภาษาอังกฤษที่ใจดีและให้กำลังใจ
    โจทย์การเขียน: ${prompt}
    งานเขียนของนักเรียน: ${draft}

    จงประเมินงานเขียนนี้ ให้คะแนน 0-5 (ดูความครบถ้วน การเรียบเรียง ไวยากรณ์ และการใช้คำศัพท์)
    แล้วเขียน feedback สั้นๆ เป็นภาษาไทย ชมจุดเด่นก่อน แล้วแนะนำสิ่งที่ควรปรับ 1-2 อย่าง
    `;

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: WritingSchema as any,
      prompt: aiPrompt,
    });

    return result.object as { score: number; feedback: string };
  } catch (error) {
    console.error("AI Writing evaluation failed, using fallback:", error);
    return {
      score: 5,
      feedback: "ส่งงานเขียนสำเร็จ! (ระบบตรวจอัตโนมัติขัดข้องชั่วคราว คุณครูจะอ่านงานของคุณอีกครั้ง)"
    };
  }
};

// Schema for teacher-mediated Language Question answers (Step 12)
const LanguageAnswerSchema = z.object({
  answer: z.string().describe('คำอธิบายภาษาอังกฤษแบบเข้าใจง่ายเป็นภาษาไทย พร้อมตัวอย่างสั้นๆ ถ้าช่วยได้')
});

export const answerLanguageQuestion = async (
  question: string,
): Promise<{ answer: string }> => {
  try {
    const aiPrompt = `
    คุณเป็นคุณครูสอนภาษาอังกฤษที่อธิบายเรื่องยากให้เข้าใจง่าย
    คำถามจากนักเรียน: ${question}

    จงตอบคำถามนี้เป็นภาษาไทยแบบกระชับ เข้าใจง่าย เหมาะกับนักเรียน
    ถ้าเป็นเรื่องไวยากรณ์หรือคำศัพท์ ให้ยกตัวอย่างประโยคสั้นๆ ประกอบ
    `;

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: LanguageAnswerSchema as any,
      prompt: aiPrompt,
    });

    return result.object as { answer: string };
  } catch (error) {
    console.error("AI Language answer failed, using fallback:", error);
    return {
      answer: "บันทึกคำถามแล้ว! (ระบบ AI ขัดข้องชั่วคราว คุณครูจะช่วยตอบคำถามนี้ในคาบเรียน)"
    };
  }
};
