/** Mock article used by the reader while real article content is unavailable (not translations). */
export const studentReadMockArticle = {
  title: "The Magic Garden",
  level: "A1",
  series: "Reading",
  levelNum: 2,
  wordCount: 142,
  readTimeMin: 3,
  content: `Once upon a time, there was a small garden behind a big house. The garden had many colorful flowers: red roses, yellow sunflowers, and purple lavender.

Every morning, a girl named Nong walked through the garden. She loved the smell of the flowers. She talked to them and gave them water.

One day, Nong found a small door in the garden wall. She opened the door and saw a magical place. There were giant butterflies, singing birds, and a rainbow waterfall.

Nong was not afraid. She smiled and said, "Hello, magic garden!"

The flowers smiled back. From that day on, Nong visited the magic garden every morning. The garden grew bigger and more beautiful.

The end.`,
  vocabulary: [
    { word: "garden", thai: "สวน", phonetic: "/garden/" },
    { word: "colorful", thai: "มีสีสัน", phonetic: "/colorful/" },
    { word: "magical", thai: "มหัศจรรย์", phonetic: "/magical/" },
    { word: "butterfly", thai: "ผีเสื้อ", phonetic: "/butterfly/" },
    { word: "rainbow", thai: "รุ้งกินน้ำ", phonetic: "/rainbow/" },
  ],
  comprehensionQ: [
    { q: "ใครเดินผ่านสวนทุกเช้า?", a: "น้องนง (Nong)" },
    { q: "น้องนงพบอะไรในกำแพงสวน?", a: "ประตูเล็กๆ" },
  ],
} as const;
