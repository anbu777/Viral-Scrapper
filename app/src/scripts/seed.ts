/**
 * Seed script to create initial data files.
 * Run with: npx tsx src/scripts/seed.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { stringify } from "csv-stringify/sync";
import { v4 as uuid } from "uuid";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Configs
const configs = [
  {
    id: uuid(),
    configName: "FABODXB",
    creatorsCategory: "dubai-real-estate",
    analysisInstruction: `Analyze this viral video and return ONLY the following fields, nothing else:

**HOOK**
The exact first 3-5 seconds of dialogue or text overlay, verbatim.

**HOOK TYPE**
One of: Bold Claim / Shock Stat / Question / Unexpected Twist / Reveal / Contrarian Take / Superlative

**HOOK TEMPLATE**
A niche-agnostic, plug-and-play version of the hook. Use [brackets] for every variable. Must be usable for any niche — beauty, finance, crypto, AI, lifestyle.

**ESTIMATED DURATION**
In seconds or minutes.

**RETENTION MECHANIC**
In 1-2 sentences: what specific moment or technique stops the viewer from scrolling mid-video?

**SHAREABLE / SAVEABLE TRIGGER**
In 1 sentence: why does someone send this to a friend or save it?

**CTA**
Explicit or implied. If none, write "None."

**FORMAT**
One of: Talking Head / Voiceover + Text / Dialogue / List Breakdown / Rant / News Explainer`,
    newConceptsInstruction: `Adapt this video for FABO, he is a Real Estate Agent in Dubai and has Premium and Luxus Real Estate working with Celebrities and Influencers. He combines knowledge and lifestyle. Like Selling-Sunset he has a group of beautiful real estate agents working for him, he is an Owner of Real Estate Agency.

Task:
Give us 3 NEW video concepts inspired by the ORIGINAL reference.
Do not copy the original.
Translate the core idea into the real estate / investor context.
MAINLY iterate and sharpen the HOOKS.

Focus:
- First 3 seconds must stop an investor from scrolling
- Hooks should challenge a belief, fear, or misconception investors have
- Calm authority > hype
- Emotional credibility > performance
- No shouting, no buzzwords, no exaggeration

The output should have this format:

# CONCEPT 1
Text description (1-3 sentences)

## HOOK
Detailed hook description (1-3 sentences)
Describe:
- What is seen in the first 2 seconds
- What is said in the first line
- Why this hook works specifically for investors 35+

## SCRIPT
Detailed script description (1-20 sentences, as many as needed)
Include:
- Scene flow
- Spoken text / voiceover
- Clear but understated payoff
- Subtle authority, not selling

# CONCEPT 2
...

# CONCEPT 3
...`,
  },
];

const configsCsv = stringify(configs, {
  header: true,
  columns: ["id", "configName", "creatorsCategory", "analysisInstruction", "newConceptsInstruction"],
});
writeFileSync(path.join(DATA_DIR, "configs.csv"), configsCsv);
console.log("Created configs.csv");

// Creators
const creators = [
  { id: uuid(), username: "marcel.remus", category: "dubai-real-estate" },
  { id: uuid(), username: "urban.dxb_", category: "dubai-real-estate" },
  { id: uuid(), username: "danieldalen", category: "dubai-real-estate" },
];

const creatorsCsv = stringify(creators, {
  header: true,
  columns: ["id", "username", "category"],
});
writeFileSync(path.join(DATA_DIR, "creators.csv"), creatorsCsv);
console.log("Created creators.csv");

// Videos - create empty with headers
const videosCsv = stringify([], {
  header: true,
  columns: ["id", "link", "thumbnail", "creator", "views", "likes", "comments", "analysis", "newConcepts", "datePosted", "dateAdded", "configName"],
});
writeFileSync(path.join(DATA_DIR, "videos.csv"), videosCsv);
console.log("Created videos.csv (empty)");

console.log("Seed complete!");
