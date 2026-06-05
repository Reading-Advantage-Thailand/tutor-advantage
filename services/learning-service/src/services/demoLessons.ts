// Fixed, free "Demo" lessons — one per level.
//
// Demo sessions reuse the live interactive socket flow, but never touch the DB,
// never call the AI evaluator, and never need a real class. The content here is
// deterministic ("เนื้อหาเหมือนกันทุกครั้ง"): each level resolves to exactly one
// hand-authored article so a tutor can try the full 14-step lesson at zero cost.
//
// Question shape mirrors what the live flow expects from Reading Advantage:
//   - multipleChoiceQuestions[].options is an object; .answer is the full option text
//   - words[].definition.th holds the Thai meaning used by the vocab game
//   - sentences[] are plain strings with >= 4 words for the sentence games

export interface DemoArticle {
  id: string;
  title: string;
  summary: string;
  passage: string;
  cefr_level: string;
  ra_level: string;
  genre?: string;
  words: { vocabulary: string; definition: { th: string }; translation: string }[];
  sentences: string[];
  multipleChoiceQuestions: {
    id: string;
    question: string;
    options: Record<string, string>;
    answer: string;
  }[];
  shortAnswerQuestions: { id: string; question: string; answer: string }[];
}

export interface DemoLesson {
  // articleId used to launch the demo (prefixed so it never collides with real ids)
  articleId: string;
  level: number;
  cefr: string;
  article: DemoArticle;
}

// One lesson per level. Add new levels here — the picker and socket both read this.
export const DEMO_LESSONS: DemoLesson[] = [
  {
    articleId: "demo-a1",
    level: 1,
    cefr: "A1",
    article: {
      id: "demo-a1",
      title: "The Friendly Dolphin",
      summary: "A short story about a dolphin that helps people at sea.",
      passage:
        "Dolphins are smart animals that live in the ocean. They swim fast and jump high above the water. Dolphins talk to each other with clicks and whistles. Sometimes a dolphin helps a person who is lost at sea. People love to watch dolphins play near boats.",
      cefr_level: "A1",
      ra_level: "Level 1",
      genre: "Animals",
      words: [
        { vocabulary: "dolphin", definition: { th: "โลมา" }, translation: "dolphin" },
        { vocabulary: "ocean", definition: { th: "มหาสมุทร" }, translation: "ocean" },
        { vocabulary: "smart", definition: { th: "ฉลาด" }, translation: "smart" },
        { vocabulary: "whistle", definition: { th: "เสียงผิวปาก, นกหวีด" }, translation: "whistle" },
        { vocabulary: "jump", definition: { th: "กระโดด" }, translation: "jump" },
      ],
      sentences: [
        "Dolphins are smart animals that live in the ocean.",
        "They swim fast and jump high above the water.",
        "Dolphins talk to each other with clicks and whistles.",
        "People love to watch dolphins play near boats.",
      ],
      multipleChoiceQuestions: [
        {
          id: "demo-a1-mcq-1",
          question: "Where do dolphins live?",
          options: { option1: "In the ocean", option2: "In the forest", option3: "In the desert", option4: "In the mountains" },
          answer: "In the ocean",
        },
        {
          id: "demo-a1-mcq-2",
          question: "How do dolphins talk to each other?",
          options: { option1: "With clicks and whistles", option2: "With letters", option3: "With phones", option4: "With drums" },
          answer: "With clicks and whistles",
        },
        {
          id: "demo-a1-mcq-3",
          question: "What do dolphins do above the water?",
          options: { option1: "They jump high", option2: "They sleep", option3: "They read", option4: "They cook" },
          answer: "They jump high",
        },
      ],
      shortAnswerQuestions: [
        { id: "demo-a1-saq-1", question: "Why do people love dolphins?", answer: "Because dolphins are smart and play near boats." },
        { id: "demo-a1-saq-2", question: "How can a dolphin help a person?", answer: "A dolphin can help a person who is lost at sea." },
      ],
    },
  },
  {
    articleId: "demo-a2",
    level: 2,
    cefr: "A2",
    article: {
      id: "demo-a2",
      title: "A Trip to the Night Market",
      summary: "A family visits a busy night market and tries local food.",
      passage:
        "On Friday evening, the Chai family went to the night market in town. The market was crowded with people and bright lights. They smelled delicious food from every corner. Dao bought grilled chicken and sticky rice, while her brother chose fresh fruit. After dinner, they listened to a local band and walked home happily.",
      cefr_level: "A2",
      ra_level: "Level 2",
      genre: "Daily Life",
      words: [
        { vocabulary: "market", definition: { th: "ตลาด" }, translation: "market" },
        { vocabulary: "crowded", definition: { th: "แออัด, คนเยอะ" }, translation: "crowded" },
        { vocabulary: "delicious", definition: { th: "อร่อย" }, translation: "delicious" },
        { vocabulary: "grilled", definition: { th: "ย่าง, ปิ้ง" }, translation: "grilled" },
        { vocabulary: "evening", definition: { th: "ตอนเย็น" }, translation: "evening" },
      ],
      sentences: [
        "The Chai family went to the night market in town.",
        "The market was crowded with people and bright lights.",
        "They smelled delicious food from every corner.",
        "After dinner they listened to a local band.",
      ],
      multipleChoiceQuestions: [
        {
          id: "demo-a2-mcq-1",
          question: "When did the family go to the market?",
          options: { option1: "Friday evening", option2: "Monday morning", option3: "Sunday noon", option4: "Tuesday night" },
          answer: "Friday evening",
        },
        {
          id: "demo-a2-mcq-2",
          question: "What did Dao buy?",
          options: { option1: "Grilled chicken and sticky rice", option2: "Fresh fruit", option3: "A new shirt", option4: "Ice cream" },
          answer: "Grilled chicken and sticky rice",
        },
        {
          id: "demo-a2-mcq-3",
          question: "What did the family do after dinner?",
          options: { option1: "Listened to a local band", option2: "Went swimming", option3: "Watched a movie", option4: "Took a train" },
          answer: "Listened to a local band",
        },
      ],
      shortAnswerQuestions: [
        { id: "demo-a2-saq-1", question: "Describe the night market.", answer: "It was crowded with people, bright lights, and delicious food." },
        { id: "demo-a2-saq-2", question: "What food did the brother choose?", answer: "He chose fresh fruit." },
      ],
    },
  },
  {
    articleId: "demo-b1",
    level: 3,
    cefr: "B1",
    article: {
      id: "demo-b1",
      title: "Why We Should Protect Bees",
      summary: "An informative piece about the importance of bees to our food.",
      passage:
        "Bees are tiny insects, but they play a huge role in our lives. When bees move from flower to flower, they carry pollen and help plants produce fruit and seeds. Without bees, many crops we eat every day would disappear. Unfortunately, the number of bees is falling because of pesticides and the loss of wild flowers. We can protect bees by planting flowers and avoiding harmful chemicals in our gardens.",
      cefr_level: "B1",
      ra_level: "Level 3",
      genre: "Science",
      words: [
        { vocabulary: "insect", definition: { th: "แมลง" }, translation: "insect" },
        { vocabulary: "pollen", definition: { th: "เกสรดอกไม้" }, translation: "pollen" },
        { vocabulary: "crop", definition: { th: "พืชผล" }, translation: "crop" },
        { vocabulary: "pesticide", definition: { th: "ยาฆ่าแมลง" }, translation: "pesticide" },
        { vocabulary: "protect", definition: { th: "ปกป้อง, คุ้มครอง" }, translation: "protect" },
      ],
      sentences: [
        "Bees play a huge role in our lives.",
        "They carry pollen and help plants produce fruit.",
        "The number of bees is falling because of pesticides.",
        "We can protect bees by planting more flowers.",
      ],
      multipleChoiceQuestions: [
        {
          id: "demo-b1-mcq-1",
          question: "What do bees carry between flowers?",
          options: { option1: "Pollen", option2: "Water", option3: "Sand", option4: "Honeycomb walls" },
          answer: "Pollen",
        },
        {
          id: "demo-b1-mcq-2",
          question: "Why is the number of bees falling?",
          options: { option1: "Pesticides and loss of wild flowers", option2: "Too much rain", option3: "Cold weather only", option4: "More flowers everywhere" },
          answer: "Pesticides and loss of wild flowers",
        },
        {
          id: "demo-b1-mcq-3",
          question: "How can we help protect bees?",
          options: { option1: "Plant flowers and avoid harmful chemicals", option2: "Cut down trees", option3: "Use more pesticides", option4: "Keep gardens empty" },
          answer: "Plant flowers and avoid harmful chemicals",
        },
      ],
      shortAnswerQuestions: [
        { id: "demo-b1-saq-1", question: "Why are bees important for our food?", answer: "They help plants produce the fruit and seeds of many crops we eat." },
        { id: "demo-b1-saq-2", question: "What is one way to protect bees?", answer: "Planting flowers and avoiding harmful chemicals in gardens." },
      ],
    },
  },
  {
    articleId: "demo-b2",
    level: 4,
    cefr: "B2",
    article: {
      id: "demo-b2",
      title: "The Rise of Remote Work",
      summary: "A discussion of how working from home is changing modern life.",
      passage:
        "Over the past few years, remote work has transformed the way millions of people earn a living. Instead of commuting to a crowded office, employees can now join meetings from their kitchen tables. Supporters argue that this flexibility improves work-life balance and reduces traffic and pollution. Critics, however, worry that working alone can weaken teamwork and blur the line between job and home. As companies experiment with hybrid schedules, society is still learning how to make remote work succeed.",
      cefr_level: "B2",
      ra_level: "Level 4",
      genre: "Society",
      words: [
        { vocabulary: "remote", definition: { th: "ทางไกล, ระยะไกล" }, translation: "remote" },
        { vocabulary: "commute", definition: { th: "เดินทางไป-กลับที่ทำงาน" }, translation: "commute" },
        { vocabulary: "flexibility", definition: { th: "ความยืดหยุ่น" }, translation: "flexibility" },
        { vocabulary: "teamwork", definition: { th: "การทำงานเป็นทีม" }, translation: "teamwork" },
        { vocabulary: "hybrid", definition: { th: "แบบผสม" }, translation: "hybrid" },
      ],
      sentences: [
        "Remote work has transformed how millions earn a living.",
        "Employees can now join meetings from their kitchen tables.",
        "This flexibility improves work-life balance for many people.",
        "Companies are experimenting with hybrid schedules today.",
      ],
      multipleChoiceQuestions: [
        {
          id: "demo-b2-mcq-1",
          question: "What do supporters say is a benefit of remote work?",
          options: { option1: "Better work-life balance", option2: "Longer commutes", option3: "More traffic", option4: "Less free time" },
          answer: "Better work-life balance",
        },
        {
          id: "demo-b2-mcq-2",
          question: "What do critics worry about?",
          options: { option1: "Weaker teamwork", option2: "Cheaper offices", option3: "Faster internet", option4: "More holidays" },
          answer: "Weaker teamwork",
        },
        {
          id: "demo-b2-mcq-3",
          question: "What schedule are companies experimenting with?",
          options: { option1: "Hybrid schedules", option2: "Night shifts only", option3: "No schedules", option4: "Weekend-only work" },
          answer: "Hybrid schedules",
        },
      ],
      shortAnswerQuestions: [
        { id: "demo-b2-saq-1", question: "How has remote work changed daily routines?", answer: "People join meetings from home instead of commuting to an office." },
        { id: "demo-b2-saq-2", question: "What is one drawback of remote work?", answer: "It can weaken teamwork and blur the line between job and home." },
      ],
    },
  },
];

// Catalog for the demo picker — metadata only, no heavy article body.
export function getDemoLessons() {
  return DEMO_LESSONS.map((lesson) => ({
    articleId: lesson.articleId,
    level: lesson.level,
    cefr: lesson.cefr,
    title: lesson.article.title,
    summary: lesson.article.summary,
    genre: lesson.article.genre ?? null,
  }));
}

// Full article body for a demo lesson, or null if the id is not a known demo lesson.
export function getDemoArticle(articleId: string): DemoArticle | null {
  // Return a deep copy so the live flow can mutate (e.g. pad fallback questions)
  // without corrupting the shared catalog for the next demo session.
  const lesson = DEMO_LESSONS.find((item) => item.articleId === articleId);
  return lesson ? JSON.parse(JSON.stringify(lesson.article)) : null;
}

export function isDemoArticleId(articleId: string): boolean {
  return DEMO_LESSONS.some((item) => item.articleId === articleId);
}
