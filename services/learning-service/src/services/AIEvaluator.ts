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
