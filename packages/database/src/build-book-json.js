// Generates packages/database/book.json from the curated book lists below.
// Article ids come from app.reading-advantage.com links; title/type/genre are
// pulled from the reading_advantage DB as the source of truth (the pasted
// spreadsheet rows contain typos and truncated titles). Falls back to the
// pasted values when an id is not found, and reports those ids loudly.
//
// Run: node src/build-book-json.js   (needs DATABASE_URL_READING_ADVANTAGE)
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const SERIES = {
  Origins: { cefrLevel: "A1", raLevelStart: 1, raLevelEnd: 3, tagline: "Your journey starts here", plannedBooks: 4, classHoursTotal: 90, independentHoursTotal: 45 },
  Quest: { cefrLevel: "A2", raLevelStart: 4, raLevelEnd: 6, tagline: "Your quest awaits", plannedBooks: 4, classHoursTotal: 100, independentHoursTotal: 45 },
  Adventure: { cefrLevel: "B1", raLevelStart: 7, raLevelEnd: 9, tagline: "Your adventure's in sight", plannedBooks: 8, classHoursTotal: 200, independentHoursTotal: 90 },
  Hero: { cefrLevel: "B2", raLevelStart: 10, raLevelEnd: 12, tagline: "You're the hero in the story", plannedBooks: 8, classHoursTotal: 200, independentHoursTotal: 90 },
  Legend: { cefrLevel: "C1", raLevelStart: 13, raLevelEnd: 15, tagline: "Legendary stories", plannedBooks: 8, classHoursTotal: 200, independentHoursTotal: 90 },
};

// [id, type, genre, title] — fallbacks only; RA DB values win when the id resolves.
const BOOKS = {
  "Origins 1": [
    ["OyEA0jRP5GnpFZBCrgMl", "Non-fiction", "Parenting", "A Happy Day for Mia"],
    ["lsiMiDgyCV9MbBjKjsyl", "Non-fiction", "Travel", "Anna's First Trip to Japan"],
    ["KkJOkCCBrfYWBMtrw7AZ", "Fiction", "Young Adult Fiction", "Anna's Secret Garden"],
    ["MjtQFpxdhlewLdgvwZMx", "Non-fiction", "Biographies", "Beyoncé: From Destiny's Child to Queen B"],
    ["cmn57x04l00f2s60et9r9k1c6", "Fiction", "Historical fiction", "Lucius's Choice"],
    ["YbIjlPcIZbnBlcvJ1q9J", "Non-fiction", "Children's Nonfiction", "Our Earth is Too Warm"],
    ["cmmki0z6z0002s60e30ppdzvg", "Non-fiction", "Children's Nonfiction", "Phones and Our Feelings"],
    ["juueom8cpLZvs4fZHdDd", "Fiction", "Adult Fiction", "The Book Thief"],
    ["vxElH4I71CEIAKxbU9bD", "Fiction", "Romance", "The Businesswoman and Her Bodyguard"],
    ["4KEEDPYfLpRWutFuYceS", "Non-fiction", "Humor", "The Comedy of Errors: Funny Tales of Mistaken Identities"],
    ["cmjhremv1000ds60ew177qfxg", "Fiction", "Horror", "The Doll Factory"],
    ["b20DYB3KOU2GLYJv1Y1r", "Fiction", "Contemporary Fiction", "The Hate U Give"],
    ["Bm9w2y9wQAf1Fr4mYUzA", "Fiction", "Western", "The Prospector's Gamble"],
    ["MMmPVvbXr1LnBo7P0oTT", "Fiction", "Young adult fiction", "The Silent Truth"],
  ],
  "Origins 2": [
    ["AgYv5H7fCZL2u2N4qBwT", "Fiction", "Young adult fiction", "The Silent Rebellion"],
    ["nFZObhzKbSGn5IFMbmf4", "Fiction", "Westerns", "The Sheriff of Deadwood"],
    ["cmjw1t3ky00mps60etppweqpu", "Non-fiction", "Travel", "My Backpack in Asia"],
    ["1lnzzXylJmtQWd39qmkQ", "Non-fiction", "Biographies", "The Life and Legacy of Nelson Mandela"],
    ["0tVl8K7MCiecTPJ1lmdE", "Fiction", "Children's Fiction", "A Soldier's Sacrifice: A Tale of Love and War"],
    ["7apvHQXjJb8od9KowL92", "Fiction", "Contemporary Fiction", "A Day in the Life of an Artist"],
    ["vGLJOdqIOYsJS0orm79e", "Non-fiction", "Science", "The Mysterious Goblin Shark: A Deep-Sea Predator"],
    ["uT67FwqUlttv74p2snCr", "Non-fiction", "Parenting", "Tommy's Screen Time"],
    ["ZT2sa9qiH0lHnYH9ayfF", "Fiction", "Westerns", "The Saloon Showdown"],
    ["cmmtse9p801a4s60en4k8d32q", "Fiction", "Horror", "The Shadow House"],
    ["cmmscy4zq00wys60eetu0jbr2", "Non-fiction", "Science", "Stars and Other Worlds"],
    ["fzMRYypdLSTFhc8rdM7h", "Non-fiction", "Cultural Criticism", "The Green Team's Mission"],
    ["5whpV1ZrLk7qb1lgAJnT", "Fiction", "Science fiction", "The Alien in the Woods"],
    ["cmkmhgh5501lds60ev7s791s5", "Fiction", "Fantasy", "Elara and the Purple Door"],
  ],
  "Origins 3.1": [
    ["cmjfm919v0232s60eo0tzv1x8", "Fiction", "Children's fiction", "The Library Map"],
    ["i4iNzw6AArWrTOU0SE6f", "Fiction", "Fantasy", "The Quest for the Golden Sword"],
    ["cmixr8kil000us60esgwguw0z", "Non-fiction", "Humor", "Funny People and Jokes"],
    ["mQBtacaks53c7Djci9n6", "Non-fiction", "Language", "English: Our World Language"],
    ["cmgu0xb0i00rqs60e2djeq0xt", "Fiction", "Young adult fiction", "The City Under Mars"],
    ["h31ImmMoHtDQS3jxOuOy", "Fiction", "Horror", "The House on the Hill"],
    ["PfzjAu0eSyuUokFK2rnk", "Fiction", "Young adult fiction", "Finding Myself"],
    ["7UQDbGLuIPZbE7yYa33x", "Non-fiction", "Self-help", "The Goal Tree"],
    ["5a3MFFCMZSJLOc2CXiy2", "Non-fiction", "Science", "The Water Quest"],
    ["ok5b5Be1QOBPzX2as2S4", "Fiction", "Fantasy", "The Quest for the Lost Gem"],
    ["BHusTKr0h8i6vOhbrfpx", "Fiction", "War", "Love in the Time of War"],
    ["rY1QKnciUBBhE9MyadbF", "Non-fiction", "Children's non-fiction", "The Amazing Human Body"],
    ["cmitgx6xd000ts60ew7qdd5a4", "Non-fiction", "Career guides", "People and Jobs"],
    ["AEh9oRp1WDa8CApSdrCr", "Non-fiction", "Self-help", "Time for School: Prioritize Tasks"],
  ],
  "Origins 3.2": [
    ["hFxfpuViJkutoIqbcUwP", "Fiction", "Westerns", "The Journey of a Young Cowboy"],
    ["cmhnbfgmv02aks60ebexfxwjv", "Fiction", "Adult fiction", "The Picture is a Secret"],
    ["chuRe1DJvPmMoRGW76hF", "Non-fiction", "Food writing", "The Garden of Hope"],
    ["ni2xVrAHyhxgCyv50gkQ", "Non-fiction", "History", "The Journey of Christopher Columbus"],
    ["ZVpzwnckH1oFrnuDiXuh", "Fiction", "Romance", "A Second Chance at Love"],
    ["h31ImmMoHtDQS3jxOuOy", "Fiction", "Horror", "The House on the Hill"],
    ["gCxlXVCOY1YnpbwsHOwg", "Non-fiction", "How-to", "The Perfect Birdhouse"],
    ["ZU86LBsTRTVADkLuBuBN", "Non-fiction", "Science", "The Amazing Journey Inside the Body"],
    ["PfzjAu0eSyuUokFK2rnk", "Fiction", "Young adult fiction", "Finding Myself"],
    ["GopoxMhN05ICdRQTzZYw", "Fiction", "Mysteries/Thriller", "The Whispering Shadows"],
    ["cmjwrjbp700tis60eq8qzcfpp", "Non-fiction", "Self-help", "A Good Way to Think"],
    ["0o7eOLMiyCT9r3iljbOd", "Non-fiction", "Flash non-fiction", "Old Places, New Life"],
    ["PV8t70u68XwKXjWh8DaR", "Fiction", "Contemporary fiction", "The Secret Diary of Sam"],
    ["seLILcBfZNSfaapisRra", "Fiction", "Horror", "The Howl in the Night"],
  ],
  "Quest 4": [
    ["4ZZeSspAGo285csIxNcc", "Fiction", "Horror", "The Haunting Ambition of Victor Frankenstein"],
    ["9VRaZ4coQyiz4gJW91av", "Fiction", "Fantasy", "The Creation Myth of Quetzalcoatl and Tezcatlipoca"],
    ["gyWWNG0hzEt4bFEHkGX1", "Non-fiction", "Science", "The Impact of Gophers on the Prairie Ecosystem"],
    ["iSYAqKTgtXABlx5IYuNY", "Non-fiction", "History", "The Enigmatic Harappan Civilization: A Glimpse into the Ancient Indus Valley"],
    ["7MrOtihsv9tsz3SaBfVC", "Fiction", "Children Fiction", "The School Chronicles: A Tale of Friendship and Empowerment"],
    ["XTXZcvdQ1juCo7wSnmtZ", "Fiction", "Young adult fiction", "The Divide"],
    ["BwJEsTpAiGfxqxvSmRZ3", "Non-fiction", "Science", "The Remarkable Arctic Lousewort: Surviving in the Harshest Environment"],
    ["CRiCha2pxDeP0xx1KqnS", "Non-fiction", "Science", "The Enigmatic Megalodon: A Giant of the Ancient Seas"],
    ["KzUwB5Uc6139Fw5fcnpx", "Fiction", "Historical Fiction", "A Scandalous Affair in Victorian England"],
    ["44QFyTUgeUGPKf9gfLlL", "Fiction", "Fantasy", "The Creation Myth of Quetzalcoatl and Tezcatlipoca"],
    ["xAo8XxZoSl5fpbkicsqe", "Non-fiction", "Science", "The Evolution of Marsupials: A Story of Adaptation and Diversification"],
    ["ayOLHwUR3JnnjVsY43yc", "Non-fiction", "Food writing", "The Influence of Regional Ingredients on Traditional Dishes: A Study of Southern Cuisine"],
    ["cmkgrpes5003os60ex7cqbzva", "Fiction", "Science Fiction", "The Chromatic Insurrection"],
    ["cml5szh5o00aas60e5wv1q9ez", "Fiction", "Young adult fiction", "The Dissonance of Silence"],
  ],
  "Quest 5": [
    ["VpbPd6AcDo1LXDmwwpcz", "Fiction", "Children's fiction", "The Curious Cat and the Mysterious Island"],
    ["LYoo0xXVqh1vxV5hPY7L", "Fiction", "Horror", "The Woman in Black"],
    ["sVt8IafJKn3g5PyjMEDA", "Non-fiction", "Language", "The Influence of Latin on Modern Languages"],
    ["bag4wyd75fJ5rUvwQXZd", "Non-fiction", "Travel", "Hiking the Inca Trail to Machu Picchu"],
    ["qzevLhkp2cShRgVIQtGN", "Fiction", "Science fiction", "The Alien Artifact"],
    ["30mWkKsXiHcmK5Py82HE", "Fiction", "Adult fiction", "Moonlight Secrets"],
    ["wWSMX7cQ66RHSv9W8RGZ", "Non-fiction", "Flash non-fiction", "A Day at the Market"],
    ["j6ZCQ1jRK2tSwXODUOo0", "Non-fiction", "Humor", "The Meme King"],
    ["5kA4C3PujXGSSt1OW4oi", "Fiction", "Mystery/Thriller", "Gone Girl"],
    ["JXmRcSQks7LTFN0ipVAy", "Fiction", "Contemporary fiction", "Little Fires Everywhere"],
    ["QQtnABasb5uOCvjoWaPd", "Non-fiction", "Journalism", "The Hidden Cost of Progress"],
    ["RoT9WUo5frmxyfjN2U9J", "Non-fiction", "Children's non fiction", "The Adaptations of Arctic Animals"],
    ["lWXWegLFVjpO1lzmeLUO", "Fiction", "Western", "The Outlaw Witch"],
    ["mIGa1v9cgtJgkXAnmVGy", "Fiction", "Contemporary fiction", "Two Sisters, Two Paths"],
  ],
  "Quest 6.1": [
    ["cmimt2el00003dcaobo9b9r3f", "Fiction", "Literary fiction", "Leo and the Hero Cat"],
    ["xhNwd3G8tk4zEqI5XYRI", "Fiction", "Young adult fiction", "The Blue Paper"],
    ["cml526drc00ges60emv019fn6", "Non-fiction", "Travel", "Costa Rica's Green Travel"],
    ["1fp84I1JPobquiidnSiT", "Non-fiction", "Children's NonFiction", "The Children's Crusade"],
    ["cmjwriyvf00sts60em3b14w7d", "Non-fiction", "Self-help", "You Can Learn and Grow"],
    ["cmjsh7kiu01q6s60ez51ws8r3", "Fiction", "Fantasy", "Kael and the Sunstone"],
    ["cmgf0s7ol00dos60efhlwbcgu", "Fiction", "Contemporary fiction", "The Secret of the River"],
    ["cmjih4iqc006ps60eur0zlqvb", "Fiction", "Literary Fiction", "Lina's Special Lunch"],
    ["cmkbrnka801c9s60e6y5n61q0", "Non-fiction", "Flash non-fiction", "My Rusty Bike"],
    ["WBTAniq6iDywaXQLBZYF", "Non-fiction", "Career guide", "Your First Business: A Teen Guide"],
    ["cml6hmdgq00n5s60etpeou7u0", "Fiction", "Children's Fiction", "The Secret of the Old Book"],
    ["cmj2ralem013us60eboxwb8pr", "Fiction", "Historical Fiction", "Clara's New Friend"],
    ["cmgpqkvxo01qds60eazl5v6a1", "Non-fiction", "Travel", "Mongolia: A Nomadic Life"],
    ["iO4trC2AgGcR843wEx94", "Non-fiction", "Crafts and Hobbies", "The Art of Letters"],
  ],
  "Adventure 7.1": [
    ["hoJzpKVdEvJRSGN5kZz4", "Fiction", "Children's fiction", "Timmy The Turtle Learns To Swim"],
    ["V4lVrdNQsadqMMG4rLEx", "Fiction", "Contemporary fiction", "The Underground Journey"],
    ["bMkxX79S3wDnV5TunNzH", "Non-fiction", "Parenting", "The Magic of Positive Words"],
    ["UASIW8snbbE4IyQTiyHY", "Non-fiction", "Philosophy", "The Curious Case of Dr. Elara"],
    ["iqPyiVb28JvJWchR2x5n", "Fiction", "Science fiction", "New Home on Zeta-5"],
    ["kthnsZE0his52tjpyDwI", "Fiction", "Young adult fiction", "The Hidden Flame"],
    ["BINSURK3l0UIjjXQ3Lho", "Non-fiction", "Biographies", "Steve Jobs: The Innovator Behind Apple"],
    ["Kngf1cWGxRby0omZRG6B", "Non-fiction", "Flash non fiction", "The Joys of Parenthood: A Flash Memoir"],
    ["9f3IhYOE7SfJjirJLHte", "Fiction", "Adult fiction", "The Nightingale Sisters"],
    ["CZkjBDAcet1AimWjwAjF", "Non-fiction", "Language", "The Future of Global Communication"],
    ["vBZRHhd6lNwTye5af2we", "Non-fiction", "Humor", "The Evolution of Mockumentaries"],
    ["9fOD2YynQ86J6U9mcnx8", "Fiction", "Science fiction", "The Pilot's Quest"],
    ["FWSuj1yh5kzajOz2ra4W", "Fiction", "War", "The Battle of the Hills and Rivers"],
  ],
  "Adventure 7.2": [
    ["mk1cGngBZEvlEMejyY1J", "Fiction", "Children Fiction", "The Magical Menagerie"],
    ["9fOD2YynQ86J6U9mcnx8", "Fiction", "Science Fiction", "The Pilot's Quest"],
    ["Usdm93Q1U6dhVEGsg54x", "Non-fiction", "Flash Nonfiction", "A Day at the Market"],
    ["WBHMs7EzNCPdrsrTkflF", "Non-fiction", "Language", "The Future of Global Communication"],
    ["j9q5K2q7a3FILal0CxRx", "Fiction", "Children Fiction", "Super Funny: The Comical Superhero"],
    ["gVYeO54oRcBTNRdgCufB", "Fiction", "Contemporary Fiction", "The Road to Hidden Hearts"],
    ["2ERO17dpy8fxPjbF9y6M", "Non-fiction", "Language", "The Evolution of Slang and Jargon"],
    ["NSpNkX8OyjXmZl3Aiw5J", "Non-fiction", "Religion and Spirituality", "The Three Paths of Peace"],
    ["ArqKbTO9S0QCaJl0r51e", "Fiction", "Children Fiction", "The Legend of Paul Bunyan and Babe the Blue Ox"],
    ["Yi3OGXBEdqSIyENRySgs", "Fiction", "Children Fiction", "Percy's Icy Adventure"],
    ["BINSURK3l0UIjjXQ3Lho", "Non-fiction", "Biographies", "Steve Jobs: The Innovator Behind Apple"],
    ["otGARuUmJDBaoxFLJJEW", "Non-fiction", "Self-help", "The Power of Small Steps"],
    ["O0NkneVeChqGGbq49fdr", "Fiction", "Contemporary Fiction", "The Bond of Resilience"],
    ["vhQPapCRtJ8zdXOODg7n", "Fiction", "Historical Fiction", "The Resistance Fighters of Occupied France in World War II"],
  ],
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_READING_ADVANTAGE });

  const allIds = [...new Set(Object.values(BOOKS).flat().map(([id]) => id))];
  const res = await pool.query(
    "SELECT id, title, type, genre FROM article WHERE id = ANY($1)",
    [allIds]
  );
  const raById = new Map(res.rows.map((r) => [r.id, r]));

  const missing = allIds.filter((id) => !raById.has(id));
  if (missing.length) {
    console.warn(`⚠️ ${missing.length} id(s) NOT found in reading_advantage (kept with pasted metadata):`);
    for (const id of missing) console.warn(`   - ${id}`);
  }

  const books = {};
  for (const [bookKey, rows] of Object.entries(BOOKS)) {
    const seen = new Set();
    books[bookKey] = [];
    for (const [id, type, genre, title] of rows) {
      if (seen.has(id)) {
        console.warn(`⚠️ Duplicate within ${bookKey} skipped: ${id} (${title})`);
        continue;
      }
      seen.add(id);
      const ra = raById.get(id);
      books[bookKey].push({
        type: ra?.type || type,
        genre: ra?.genre || genre,
        title: ra?.title || title,
        id,
      });
    }
  }

  const output = { series: SERIES, books };
  const outPath = path.resolve(__dirname, "../book.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  const totalArticles = Object.values(books).reduce((n, list) => n + list.length, 0);
  console.log(`✅ Wrote ${outPath}: ${Object.keys(books).length} books, ${totalArticles} article entries (${allIds.length} unique ids, ${raById.size} resolved in RA).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  });
