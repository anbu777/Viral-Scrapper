/**
 * Pre-built prompt templates for different niches.
 * Users can pick from these as a starting point in the Configs page.
 */

export type NicheKey = "finance" | "beauty" | "tech" | "realestate" | "fitness" | "education" | "general";

export interface PromptTemplate {
  niche: NicheKey;
  label: string;
  description: string;
  analysisPrompt: string;
  conceptsPrompt: string;
}

export const PROMPT_TEMPLATES: Record<NicheKey, PromptTemplate> = {
  finance: {
    niche: "finance",
    label: "Finance & Crypto",
    description: "Investment, trading, business, crypto content",
    analysisPrompt: `Analyze this short-form finance/crypto video for viral content patterns.

Focus on:
1. **Hook Pattern**: First 3 seconds — what makes viewers stop scrolling?
2. **Authority Signals**: How does the creator establish credibility (numbers, screen recordings, charts)?
3. **Information Density**: How is complex financial info simplified?
4. **Emotional Triggers**: FOMO, fear of loss, urgency, opportunity
5. **CTA Style**: How does the video end? Subscribe, comment, save?
6. **Visual Format**: Talking head, screen recording, B-roll, text overlays
7. **Pacing**: Word density per second, cut frequency

Output a structured analysis covering: hook, summary, transcript, ocrText (any on-screen numbers/text), visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags (claims that may be misleading), and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral finance video, generate 3 NEW adapted concepts that:
1. Use the same proven hook pattern but with different topic angles
2. Maintain the authority signals and visual format
3. Are achievable for a personal finance creator (not requiring institutional access)
4. Have clear, actionable takeaways
5. End with a strong CTA appropriate for the audience

For each concept, provide: title, hook (first 3 seconds spoken), main script (45-60 seconds), CTA, and key visuals needed.`,
  },

  beauty: {
    niche: "beauty",
    label: "Beauty & Lifestyle",
    description: "Makeup, skincare, fashion, lifestyle content",
    analysisPrompt: `Analyze this short-form beauty/lifestyle video for viral content patterns.

Focus on:
1. **Visual Hook**: Before/after reveal, transformation moment, surprising product
2. **Aesthetic**: Color palette, lighting, set design, product placement
3. **Pacing**: Quick cuts vs slow reveals, beat drops, visual rhythm
4. **Trust Signals**: Skin texture, real results, ingredient mentions
5. **Audience Identification**: Who is this person speaking to?
6. **Trend Integration**: Current sounds, formats, challenges
7. **Voiceover Style**: ASMR, conversational, educational

Output a structured analysis covering: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags, and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral beauty video, generate 3 NEW adapted concepts that:
1. Use the same visual hook pattern with different products/looks
2. Maintain the aesthetic and pacing
3. Are achievable with consumer-grade products and home setup
4. Include clear product placement opportunities
5. End with a relatable, audience-specific CTA

For each concept, provide: title, hook (first 3 seconds), main script (30-45 seconds), CTA, and key visuals/products needed.`,
  },

  tech: {
    niche: "tech",
    label: "Tech & AI",
    description: "AI tools, software, gadgets, productivity",
    analysisPrompt: `Analyze this short-form tech/AI video for viral content patterns.

Focus on:
1. **Mind-Blow Moment**: What's the "wait, that's possible?" reveal?
2. **Demo Quality**: Real screen recording vs explanation, speed of result
3. **Practical Application**: Is the use case clear and immediately applicable?
4. **Authority**: How does the creator establish tech expertise?
5. **Stakes**: Why should viewers care RIGHT NOW (FOMO on new tool)?
6. **Tutorial Format**: Step-by-step vs overview vs comparison
7. **Tools Mentioned**: Specific software, AI models, websites

Output a structured analysis covering: hook, summary, transcript, ocrText (any tool names/URLs visible), visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags, and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral tech video, generate 3 NEW adapted concepts that:
1. Use the same mind-blow hook with different tools/AI features
2. Maintain the demo-driven format
3. Showcase practical, immediately-usable applications
4. Include specific tool/website mentions
5. End with a clear next-step CTA (try it now, follow for more, save this)

For each concept, provide: title, hook, main script (30-60 seconds with timestamps for screen demos), CTA, and tools needed.`,
  },

  realestate: {
    niche: "realestate",
    label: "Real Estate",
    description: "Property tours, market analysis, investment",
    analysisPrompt: `Analyze this short-form real estate video for viral content patterns.

Focus on:
1. **Visual Hook**: Property reveal moment, surprise feature, dramatic shot
2. **Numbers & Stats**: Price reveal, ROI, square footage, comparisons
3. **Storytelling**: Who lives here, lifestyle, aspirational element
4. **Market Authority**: Local expertise, data references, predictions
5. **Cinematography**: Drone shots, walk-throughs, transitions
6. **Pacing**: Reveal timing, voiceover density
7. **CTA**: DM for tours, save for later, follow for listings

Output a structured analysis covering: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags, and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral real estate video, generate 3 NEW adapted concepts that:
1. Use the same reveal/storytelling pattern
2. Are achievable for a single-agent operation (no Hollywood production)
3. Include specific data points (price, ROI, market trend)
4. Have aspirational lifestyle elements
5. End with a buyer/follower-specific CTA

For each concept, provide: title, hook, main script (45-75 seconds), key shots needed, CTA.`,
  },

  fitness: {
    niche: "fitness",
    label: "Fitness & Health",
    description: "Workouts, nutrition, transformation content",
    analysisPrompt: `Analyze this short-form fitness/health video for viral content patterns.

Focus on:
1. **Transformation Hook**: Before/after, muscle reveal, technique demo
2. **Practical Value**: Is the exercise/tip immediately doable?
3. **Form & Technique**: How is proper form taught?
4. **Motivation Style**: Tough love, encouraging, scientific
5. **Authority**: Credentials, results, certifications shown
6. **Music/Energy**: BPM, beat drops, energy curve
7. **Equipment**: Bodyweight, gym, home — accessibility level

Output a structured analysis covering: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags (form/safety concerns), and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral fitness video, generate 3 NEW adapted concepts that:
1. Use the same transformation/demo hook
2. Are safe and achievable for the target fitness level
3. Include proper form cues and modifications
4. Match the motivation style of the original
5. End with audience-appropriate CTA

For each concept, provide: title, hook, main script (30-60 seconds), exercise/tip details, CTA.`,
  },

  education: {
    niche: "education",
    label: "Education & How-To",
    description: "Tutorials, life hacks, learning content",
    analysisPrompt: `Analyze this short-form educational video for viral content patterns.

Focus on:
1. **Curiosity Hook**: "Most people don't know...", "I learned this in...", "The trick is..."
2. **Information Architecture**: Step 1, 2, 3 vs single insight vs comparison
3. **Credibility**: Expert references, personal experience, source citations
4. **Visual Aids**: Diagrams, demonstrations, examples
5. **Accessibility**: Is the explanation clear without jargon?
6. **Pacing**: How is comprehension balanced with brevity?
7. **CTA**: Save, share, follow for more

Output a structured analysis covering: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience profile, viralMechanics array, riskFlags, and sourceEvidence.`,
    conceptsPrompt: `Based on the analyzed viral educational video, generate 3 NEW adapted concepts that:
1. Use the same curiosity hook structure
2. Teach a specific, useful skill or insight
3. Are clear and actionable
4. Include specific examples or demonstrations
5. End with a save/share CTA

For each concept, provide: title, hook, main script (45-60 seconds), examples/visuals needed, CTA.`,
  },

  general: {
    niche: "general",
    label: "General Purpose",
    description: "Generic template for any content type",
    analysisPrompt: `Analyze this short-form video for viral content patterns.

Provide a comprehensive breakdown:
1. **Hook**: First 3 seconds — exact words and visuals
2. **Summary**: 2-3 sentence overview of the video's narrative
3. **Transcript**: Word-for-word spoken content
4. **OCR Text**: Any on-screen text, captions, graphics
5. **Visual Pattern**: Camera angles, settings, props, color palette
6. **Pacing**: Words per second, cut frequency, energy curve
7. **Format**: Talking head, vlog, tutorial, comedy, transformation, etc.
8. **Audience**: Who is the ideal viewer for this content?
9. **Viral Mechanics**: What specific elements drive shares/saves/comments?
10. **Risk Flags**: Any concerning claims or sensitive topics?
11. **Source Evidence**: Quote specific moments that prove your analysis.

Output as structured JSON.`,
    conceptsPrompt: `Based on the analyzed viral video, generate 3 NEW adapted concepts that:
1. Use the same proven hook pattern
2. Maintain the visual format and pacing
3. Are achievable with similar production resources
4. Have clear value delivery
5. End with a strong, audience-appropriate CTA

For each concept, provide: title, hook (first 3 seconds), main script (30-90 seconds depending on format), key visuals, and CTA.`,
  },
};

export function getTemplateByNiche(niche: NicheKey): PromptTemplate {
  return PROMPT_TEMPLATES[niche] || PROMPT_TEMPLATES.general;
}

export function getAllTemplates(): PromptTemplate[] {
  return Object.values(PROMPT_TEMPLATES);
}
