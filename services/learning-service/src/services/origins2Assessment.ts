// Immutable pilot forms. Change the version when editing any item or recording.
// Primary Origins 2 uses catalog levelNumber 20 (the code for level 2.0).
export const FORM_VERSION = "primary-origins2-v1";
export type Stage = "PRE" | "POST";
export type Skill = "vocabulary" | "reading" | "listening";
export type Item = {
  id: string; skill: Skill; prompt: string; options: string[]; correct: number;
  passage?: string; audioText?: string; audioUrl?: string;
};
export function supportsAssessment(book: { bookCode: string; levelNumber: number; series: { code: string } }) {
  return book.levelNumber === 20 && book.series.code.toLowerCase() === "primary-origins" &&
    book.bookCode.toLowerCase() === "primary origins 2";
}
type Seed = [string, string[], number];
function form(prefix: string, vocabulary: Seed[], passage: string, reading: Seed[], listening: Seed[], audio: string[]): Item[] {
  return [
    ...vocabulary.map(([prompt, options, correct], i) => ({ id: `${prefix}-v${i+1}`, skill: "vocabulary" as const, prompt, options, correct })),
    ...reading.map(([prompt, options, correct], i) => ({ id: `${prefix}-r${i+1}`, skill: "reading" as const, prompt, options, correct, passage })),
    ...listening.map(([prompt, options, correct], i) => ({ id: `${prefix}-l${i+1}`, skill: "listening" as const, prompt, options, correct, audioText: audio[i], audioUrl: `/assessment-audio/${FORM_VERSION}-${prefix}-${i+1}.wav` })),
  ];
}
export const FORMS: Record<Stage, Item[]> = {
  PRE: form("a", [
    ["คำว่า puppy หมายถึงอะไร?", ["ลูกสุนัข", "ปลา", "นก", "แมว"], 0],
    ["คำว่า soft หมายถึงอะไร?", ["แข็ง", "นุ่ม", "หยาบ", "ร้อน"], 1],
    ["คำว่า happy หมายถึงอะไร?", ["หิว", "หนาว", "มีความสุข", "กลัว"], 2],
    ["คำว่า red คือสีอะไร?", ["ฟ้า", "เขียว", "เหลือง", "แดง"], 3],
    ["คำว่า milk หมายถึงอะไร?", ["น้ำ", "นม", "ข้าว", "ไข่"], 1],
  ], "This is Ben. Ben is a boy. He has a red ball. The ball is small. Ben plays at school. Ben is happy.", [
    ["Who is the boy?", ["Ben", "Tom", "Sam", "Dan"], 0],
    ["What does Ben have?", ["A book", "A bag", "A ball", "A cup"], 2],
    ["What color is the ball?", ["Blue", "Red", "Green", "Yellow"], 1],
    ["Is the ball big or small?", ["Big", "Small", "Big and small", "The story does not say"], 1],
    ["Where does Ben play?", ["At the zoo", "At the beach", "At home", "At school"], 3],
  ], [
    ["ฟังเสียง แล้วเลือกสัตว์ที่ได้ยิน", ["Cat", "Fish", "Dog", "Bird"], 2],
    ["ฟังเสียง แล้วเลือกสีที่ได้ยิน", ["Blue", "Red", "Yellow", "Green"], 0],
    ["ฟังเสียง แล้วเลือกอาหารที่ได้ยิน", ["Rice", "Eggs", "Milk", "Apples"], 1],
    ["ฟังเสียง แล้วเลือกสิ่งของที่ได้ยิน", ["Ball", "Cup", "Bag", "Book"], 3],
    ["ฟังเสียง แล้วเลือกความรู้สึกที่ได้ยิน", ["Sad", "Happy", "Scared", "Angry"], 1],
  ], ["I see a dog.", "The bag is blue.", "I like eggs.", "This is my book.", "The girl is happy."]),
  POST: form("b", [
    ["เลือกความหมายของ puppy", ["นก", "แมว", "ลูกสุนัข", "ปลา"], 2],
    ["เลือกความหมายของ soft", ["นุ่ม", "ร้อน", "แข็ง", "หยาบ"], 0],
    ["เลือกความหมายของ happy", ["กลัว", "หิว", "หนาว", "มีความสุข"], 3],
    ["เลือกสีที่ตรงกับ red", ["เหลือง", "แดง", "ฟ้า", "เขียว"], 1],
    ["เลือกความหมายของ milk", ["ไข่", "ข้าว", "นม", "น้ำ"], 2],
  ], "This is May. May is a girl. She has a blue bag. The bag is big. May reads at home. May is happy.", [
    ["Who is the girl?", ["Ann", "Kim", "Sue", "May"], 3],
    ["What does May have?", ["A bag", "A cup", "A ball", "A book"], 0],
    ["What color is the bag?", ["Red", "Green", "Blue", "Yellow"], 2],
    ["Is the bag big or small?", ["Small", "Big and small", "The story does not say", "Big"], 3],
    ["Where does May read?", ["At school", "At home", "At the zoo", "At the beach"], 1],
  ], [
    ["ฟังเสียง แล้วเลือกสัตว์ที่ได้ยิน", ["Dog", "Bird", "Cat", "Fish"], 0],
    ["ฟังเสียง แล้วเลือกสีที่ได้ยิน", ["Green", "Yellow", "Red", "Blue"], 3],
    ["ฟังเสียง แล้วเลือกอาหารที่ได้ยิน", ["Apples", "Milk", "Eggs", "Rice"], 2],
    ["ฟังเสียง แล้วเลือกสิ่งของที่ได้ยิน", ["Cup", "Book", "Ball", "Bag"], 1],
    ["ฟังเสียง แล้วเลือกความรู้สึกที่ได้ยิน", ["Happy", "Angry", "Sad", "Scared"], 0],
  ], ["This is a dog.", "The ball is blue.", "I see eggs.", "I have a book.", "The boy is happy."]),
};
export function publicItems(stage: Stage) {
  return FORMS[stage].map(({ correct: _correct, audioText: _audioText, ...item }) => item);
}
export function grade(stage: Stage, answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("INVALID_ANSWERS");
  const input = answers as Record<string, unknown>;
  const items = FORMS[stage];
  if (Object.keys(input).length !== items.length) throw new Error("INVALID_ANSWERS");
  const scores: Record<Skill, number> = { vocabulary: 0, reading: 0, listening: 0 };
  const checked: Record<string, number> = {};
  for (const item of items) {
    const value = input[item.id];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= item.options.length) throw new Error("INVALID_ANSWERS");
    checked[item.id] = value;
    if (value === item.correct) scores[item.skill]++;
  }
  return { answers: checked, scores, total: Object.values(scores).reduce((a, b) => a + b, 0) };
}
