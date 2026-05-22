"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateShortAnswer = void 0;
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const zod_1 = require("zod");
// Zod schema for evaluation result
const EvaluationSchema = zod_1.z.object({
    score: zod_1.z.number().describe('คะแนน 0-5 ขึ้นอยู่กับความถูกต้องและครบถ้วนของคำตอบ'),
    feedback: zod_1.z.string().describe('ข้อเสนอแนะเป็นภาษาไทย อธิบายว่าตอบถูกไหม ขาดอะไรไปบ้าง หรือชมเชย')
});
const evaluateShortAnswer = async (question, expectedAnswer, studentAnswer) => {
    try {
        const prompt = `
    คุณเป็นคุณครูสอนภาษาอังกฤษที่ใจดีและให้คำแนะนำที่เป็นประโยชน์
    โจทย์: ${question}
    เฉลยที่คาดหวัง: ${expectedAnswer}
    คำตอบของนักเรียน: ${studentAnswer}

    จงตรวจคำตอบของนักเรียน ให้คะแนน 0-5 และเขียนคำอธิบายสั้นๆ (feedback) เป็นภาษาไทย
    `;
        const result = await (0, ai_1.generateObject)({
            model: (0, google_1.google)('gemini-2.5-flash'),
            schema: EvaluationSchema,
            prompt: prompt,
        });
        return result.object;
    }
    catch (error) {
        console.error("AI Evaluation failed, using fallback:", error);
        // Fallback: Give full score to allow student to proceed, but with a note
        return {
            score: 5,
            feedback: "ส่งคำตอบสำเร็จ! (ระบบตรวจอัตโนมัติขัดข้องชั่วคราว คุณครูจะตรวจซ้ำอีกครั้ง)"
        };
    }
};
exports.evaluateShortAnswer = evaluateShortAnswer;
