/**
 * Golden Dataset v0.1 (Run 2026-10-08-ASSESSMENT-ENGINE-002, Slices B5/B6; AE-004 / AE-033).
 *
 * EVALUATION FIXTURE for the unwired deterministic linter (question-lint.ts), NOT training data.
 * Synthetic, general-knowledge content only: no Ruppin or other real course content, no student data.
 * Hebrew-first with an English / mixed-script slice. Small on purpose so every case stays reviewable
 * by a Hebrew-fluent human (annotators and agreement protocol are still an OPEN QUESTION).
 *
 * Reading a case:
 *  - expectedCodes / forbiddenCodes are GROUND TRUTH ("what a careful reviewer says"), not linter output.
 *  - knownMiss / knownFalsePositive record where the current linter honestly disagrees with ground truth.
 *    They were established by running the linter; expectations were NOT bent to match it.
 *  - semanticExpectation (SEMANTIC_EXPECTATION) is a judgment the deterministic linter cannot prove.
 *    It is never asserted against the linter.
 */
import type { QuestionLintInput } from "../question-lint";
import type { GoldenCase, GoldenDataset, GoldenExpected } from "./golden-types";

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------
const IDS = ["A", "B", "C", "D", "E", "F"];
const EXPLANATION = "הסבר קצר: התשובה הנכונה מוסברת כאן בקצרה.";

interface QOpts {
  type?: string;
  explanation?: string | null;
}

/** Builds a question; `correct` is the index (or indexes) of the key option(s). */
function q(prompt: string, contents: string[], correct: number | number[], o: QOpts = {}): QuestionLintInput {
  const idx = Array.isArray(correct) ? correct : [correct];
  return {
    questionType: o.type ?? (idx.length > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE"),
    prompt,
    answerOptions: contents.map((content, i) => ({ id: IDS[i] ?? `X${i}`, content })),
    correctOptionIds: idx.map((i) => IDS[i] ?? `X${i}`),
    explanation: o.explanation === undefined ? EXPLANATION : o.explanation,
  };
}

function exp(
  expectedCodes: string[],
  forbiddenCodes: string[] = [],
  extra: Partial<GoldenExpected> = {},
): GoldenExpected {
  return { expectedCodes, forbiddenCodes, ...extra };
}

/** Clean = no WARNING or ERROR is correct. */
function clean(extra: Partial<GoldenExpected> = {}): GoldenExpected {
  return { expectedCodes: [], forbiddenCodes: [], clean: true, ...extra };
}

/** Hostile / unreadable value that throws on any property read. */
const THROWING: unknown = new Proxy({}, {
  get() {
    throw new Error("unreadable");
  },
});

// ---------------------------------------------------------------------------------------------
// Item pool for set cases: 12 distinct, balanced, clean Hebrew items (key + 3 distractors each).
// ---------------------------------------------------------------------------------------------
interface PoolEntry {
  prompt: string;
  key: string;
  distractors: [string, string, string];
}
const POOL: PoolEntry[] = [
  { prompt: "מהי בירתה של מדינת איטליה לפי המפה הפוליטית?", key: "רומא", distractors: ["מילאנו", "נאפולי", "טורינו"] },
  { prompt: "כמה זוויות ישרות יש בריבוע רגיל במישור?", key: "ארבע", distractors: ["שתיים", "שלוש", "שש"] },
  { prompt: "איזה גז נחוץ לבני אדם לנשימה בסיסית?", key: "חמצן", distractors: ["ארגון", "הליום", "מימן"] },
  { prompt: "באיזה כיוון זורח השמש בבוקר רגיל?", key: "מזרח", distractors: ["מערב", "צפון", "דרום"] },
  { prompt: "מהו המכפלה של שבע ושמונה בחשבון?", key: "56", distractors: ["54", "48", "63"] },
  { prompt: "איזו חיה נחשבת לחיית בית נפוצה בבתים?", key: "חתול", distractors: ["נמר", "זאב", "דוב"] },
  { prompt: "מה מצב הצבירה של מים בטמפרטורת חדר?", key: "נוזל", distractors: ["מוצק", "גז", "פלזמה"] },
  { prompt: "איזה חודש מגיע מיד אחרי חודש מרץ?", key: "אפריל", distractors: ["מאי", "פברואר", "יוני"] },
  { prompt: "כמה ימים יש בשבוע רגיל בלוח השנה?", key: "שבעה", distractors: ["חמישה", "שישה", "עשרה"] },
  { prompt: "איזה כלי משמש למדידת אורך של שולחן?", key: "סרגל", distractors: ["מאזניים", "מדחום", "שעון"] },
  { prompt: "איזה צבע מתקבל מערבוב כחול עם צהוב?", key: "ירוק", distractors: ["סגול", "כתום", "חום"] },
  { prompt: "באיזו עונה בדרך כלל יורד שלג בהרים?", key: "חורף", distractors: ["קיץ", "סתיו", "אביב"] },
];

/** Balanced key positions: each of 4 positions used 3 times, no run longer than 1. */
const BALANCED_POSITIONS = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 3, 1];

function poolItem(p: PoolEntry, keyPos: number, keySuffix = ""): QuestionLintInput {
  const opts = [...p.distractors];
  opts.splice(keyPos, 0, p.key + keySuffix);
  return q(p.prompt, opts, keyPos);
}

/** The full clean 12-item set, with optional per-index overrides. */
function cleanSet(
  positions: number[] = BALANCED_POSITIONS,
  override: Record<number, QuestionLintInput> = {},
  keySuffix: (i: number) => string = () => "",
): QuestionLintInput[] {
  return POOL.map((p, i) => override[i] ?? poolItem(p, positions[i], keySuffix(i)));
}

/** Replaces the given item prompts (keeps options). */
function withPrompt(item: QuestionLintInput, prompt: string): QuestionLintInput {
  return { ...item, prompt };
}

// ---------------------------------------------------------------------------------------------
// ITEM cases
// ---------------------------------------------------------------------------------------------
const itemCases: GoldenCase[] = [
  // ---- Strong questions (CLEAN) ----
  {
    id: "STRONG-SC-HE-01", scope: "ITEM", tags: ["strong", "single-choice", "hebrew", "fact"],
    description: "Strong Hebrew single-choice fact item with balanced options and an explanation.",
    input: q("מהי בירתה של מדינת איטליה לפי המפה הפוליטית?", ["מילאנו", "רומא", "נאפולי", "טורינו"], 1),
    expected: clean(),
  },
  {
    id: "STRONG-SC-EN-01", scope: "ITEM", tags: ["strong", "single-choice", "english", "fact"],
    description: "Strong English single-choice fact item.",
    input: q("Which gas do humans need for basic breathing?", ["Argon", "Helium", "Oxygen", "Hydrogen"], 2),
    expected: clean(),
  },
  {
    id: "STRONG-MC-HE-01", scope: "ITEM", tags: ["strong", "multiple-choice", "hebrew", "numbers"],
    description: "Strong Hebrew multiple-choice item, two keys out of four.",
    input: q("אילו מהמספרים הבאים הם מספרים זוגיים בין אחד לעשר?", ["שניים", "שלושה", "ארבעה", "חמישה"], [0, 2]),
    expected: clean(),
  },
  {
    id: "STRONG-MC-EN-01", scope: "ITEM", tags: ["strong", "multiple-choice", "english"],
    description: "Strong English multiple-choice item, two keys out of four.",
    input: q("Select the planets that belong to our solar system.", ["Mars", "Sirius", "Venus", "Andromeda"], [0, 2]),
    expected: clean(),
  },
  {
    id: "STRONG-SC-HE-NUM-01", scope: "ITEM", tags: ["strong", "single-choice", "hebrew", "numerals", "calculation"],
    description: "Strong Hebrew calculation item with numeric options.",
    input: q("כמה הם 12 ועוד 15 בחישוב רגיל?", ["26", "27", "28", "17"], 1),
    expected: clean(),
  },
  {
    id: "STRONG-SC-MIXED-01", scope: "ITEM", tags: ["strong", "single-choice", "mixed-script", "numerals"],
    description: "Hebrew stem with a numeral key; clean mixed digits/Hebrew item.",
    input: q("כמה ביטים יש בבייט אחד במחשב?", ["4", "8", "16", "32"], 1),
    expected: clean(),
  },
  {
    id: "STRONG-SC-MIXED-02", scope: "ITEM", tags: ["strong", "single-choice", "mixed-script", "latin-acronym"],
    description: "Hebrew stem with Latin acronyms inside RTL options (RTL/LTR mix); clean.",
    input: q("איזה פרוטוקול משמש בדרך כלל לגלישה מאובטחת באתרים?", ["FTP", "SSH", "HTTPS", "SMTP"], 2),
    expected: clean(),
  },

  // ---- CLEAN near-misses that must not warn (false-positive measurement) ----
  {
    id: "CLEAN-HE-MALE-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "negation-near-miss"],
    description: "Stem contains Hebrew 'מלא' (full) and 'אלא' (but); neither is a negation. Distractor is 'מלא'.",
    input: q("הנוסע הגיע מלא תקווה אלא שהמלון היה סגור. מה היה מצב המלון?", ["פתוח", "סגור", "מלא", "נטוש"], 1),
    expected: clean(),
  },
  {
    id: "CLEAN-HE-MALE-02", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "negation-near-miss"],
    description: "Stem 'מהו ההפך של המילה מלא' - 'מלא' must not read as negation.",
    input: q("מהו ההפך של המילה מלא בשפה העברית?", ["גדול", "ריק", "כבד", "קר"], 1),
    expected: clean(),
  },
  {
    id: "CLEAN-HE-MELACHA-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "negation-near-miss"],
    description: "Stem 'מלאכה' (craft) must not read as negation.",
    input: q("איזו מלאכה מחייבת שימוש במסמרים ובפטיש?", ["נגרות", "אפייה", "תפירה", "ציור"], 0),
    expected: clean(),
  },
  {
    id: "CLEAN-EN-NEARMISS-01", scope: "ITEM", tags: ["clean", "english", "false-positive-guard", "all-none-near-miss"],
    description: "Options 'Nonexistent' / 'Allocation' / 'Allowance' are not 'none of the above' / 'all of the above' / absolute terms.",
    input: q("Which noun means assigning resources to a team?", ["Allocation", "Nonexistent", "Allowance", "Banner"], 0),
    expected: clean({ forbiddenCodes: ["OPTION_ALL_OF_ABOVE", "OPTION_NONE_OF_ABOVE", "OPTION_ABSOLUTE_TERM"] }),
  },
  {
    id: "CLEAN-HE-KAL-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "absolute-near-miss"],
    description: "Option 'כלל' (rule) is not the absolute 'כל'.",
    input: q("איך נקראת הנחיה קבועה שמתארת התנהגות מצופה בחברה?", ["מזל", "כלל", "חלום", "צליל"], 1),
    expected: clean({ forbiddenCodes: ["OPTION_ABSOLUTE_TERM"] }),
  },

  // ---- Weak: absolute language ----
  {
    id: "WEAK-ABSOLUTE-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "absolute-language"],
    description: "Distractors use 'תמיד' and 'לעולם' (absolute language cues).",
    input: q("מה נכון לגבי מים בטמפרטורת חדר רגילה?", ["הם תמיד קפואים", "הם נוזליים", "הם לעולם לא נוזליים", "הם מתאדים מיד"], 1),
    expected: exp(["OPTION_ABSOLUTE_TERM"], []),
  },
  {
    id: "WEAK-ABSOLUTE-HE-PREFIX-01", scope: "ITEM", tags: ["weak", "hebrew", "absolute-language", "prefix"],
    description: "Absolute terms with attached prefixes: 'ותמיד' and 'שתמיד'.",
    input: q("איזה משפט מתאר נכון את מזג האוויר בישראל?", ["חם בקיץ ויבש", "חם ותמיד לח", "קר כך שתמיד יורד שלג", "קר ובהיר"], 0),
    expected: exp(["OPTION_ABSOLUTE_TERM"], []),
  },
  {
    id: "WEAK-ABSOLUTE-EN-01", scope: "ITEM", tags: ["weak", "english", "absolute-language"],
    description: "Distractors use 'always' and 'only'.",
    input: q("Which statement about sleep is accurate?", ["Everyone always needs ten hours", "Sleep needs vary by person", "Only children need sleep", "Sleep is never useful"], 1),
    expected: exp(["OPTION_ABSOLUTE_TERM"], []),
  },
  {
    id: "FP-ABSOLUTE-SOUP-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "absolute-prefix-collision"],
    description: "Key 'מרק' (soup) is not the absolute 'רק' (only) with a prefix; ground truth says no absolute-term warning.",
    input: q("איזה מזון חם מוגש לרוב בתחילת ארוחה בצהריים?", ["קינוח", "מרק", "סלט", "כריך"], 1),
    expected: clean({
      forbiddenCodes: ["OPTION_ABSOLUTE_TERM"],
      knownFalsePositive: { codes: ["OPTION_ABSOLUTE_TERM"], reason: "Prefix stripping reads 'מרק' (soup) as מ+רק ('only'); same family: 'ברק' lightning, 'שכל' wit, 'שום' garlic." },
    }),
  },
  {
    id: "FP-ABSOLUTE-LIGHTNING-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "absolute-prefix-collision"],
    description: "Option 'ברק' (lightning) is not 'ב'+'רק' (only).",
    input: q("איזו תופעת טבע נראית בשמיים בזמן סערה חזקה?", ["שלג", "ברק", "ערפל", "קשת"], 1),
    expected: clean({
      forbiddenCodes: ["OPTION_ABSOLUTE_TERM"],
      knownFalsePositive: { codes: ["OPTION_ABSOLUTE_TERM"], reason: "'ברק' is read as ב+רק; root-initial prefix letter (accepted heuristic limit, ASSESSMENT_ENGINE section 19.4)." },
    }),
  },

  // ---- Weak: answer length ----
  {
    id: "WEAK-LONGEST-KEY-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "longest-answer-bias"],
    description: "Key is clearly the longest option (ratio ~2, difference >= 15 characters).",
    input: q("מהי פוטוסינתזה בצמחים בקצרה?", ["תהליך של עיכול מזון בקיבה", "תהליך שבו צמחים הופכים אור שמש, מים ופחמן דו חמצני לסוכר וחמצן", "תהליך של התאדות מים מהים", "תהליך של שקיעת סלעים בנהר"], 1),
    expected: exp(["KEY_LONGEST_OPTION"], ["OPTION_LENGTH_IMBALANCE", "STEM_TOO_SHORT"]),
  },
  {
    id: "WEAK-LONGEST-KEY-EN-01", scope: "ITEM", tags: ["weak", "english", "longest-answer-bias"],
    description: "English key is the longest option by a wide margin.",
    input: q("What does a thermometer measure?", ["The weight of an object", "The distance between towns", "The temperature of an object or of the surrounding air", "The time of day in a city"], 2),
    expected: exp(["KEY_LONGEST_OPTION"], ["OPTION_LENGTH_IMBALANCE"]),
  },
  {
    id: "WEAK-LENGTH-IMBALANCE-01", scope: "ITEM", tags: ["weak", "hebrew", "length-imbalance"],
    description: "A distractor is much longer than the shortest option, key in the middle.",
    input: q("איזו מילה היא שם של חיה?", ["אריה", "נמר", "כסא ושולחן ומיטה וארון ותמונה גדולה בסלון", "דג"], 0),
    expected: exp(["OPTION_LENGTH_IMBALANCE"], ["KEY_LONGEST_OPTION"]),
  },

  // ---- Weak: lexical leakage ----
  {
    id: "WEAK-LEAKAGE-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "lexical-leakage"],
    description: "Key repeats two content words of the stem; distractors repeat none.",
    input: q("איזה גורם משפיע על קביעת המחירים בשוק חופשי?", ["מזג האוויר", "ביקוש והיצע בשוק חופשי", "צבע השטרות", "גובה הבניינים"], 1),
    expected: exp(["KEY_STEM_LEXICAL_OVERLAP"], []),
  },
  {
    id: "WEAK-LEAKAGE-HE-PREFIX-01", scope: "ITEM", tags: ["weak", "hebrew", "lexical-leakage", "prefix"],
    description: "Leaked words differ only by attached prefixes (ה/ו/ב) from the stem.",
    input: q("מי אישרה את ההחלטה בנושא התקציב השנתי?", ["מורה בבית ספר", "ועדת התקציב השנתי", "נהג אוטובוס", "שחקן כדורסל"], 1),
    expected: exp(["KEY_STEM_LEXICAL_OVERLAP"], []),
  },
  {
    id: "WEAK-LEAKAGE-EN-01", scope: "ITEM", tags: ["weak", "english", "lexical-leakage"],
    description: "English key repeats two stem words.",
    input: q("Which process converts sunlight into chemical energy in plants?", ["Digestion of food in the stomach", "Sunlight conversion into chemical energy", "Erosion of rock by wind and rain", "Evaporation of water from lakes"], 1),
    expected: exp(["KEY_STEM_LEXICAL_OVERLAP"], ["KEY_LONGEST_OPTION", "OPTION_LENGTH_IMBALANCE"]),
  },
  {
    id: "WEAK-LEAKAGE-HE-INFLECTION-01", scope: "ITEM", tags: ["weak", "hebrew", "lexical-leakage", "inflection"],
    description: "Key leaks stem words in a different inflection (singular vs plural, with/without construct form).",
    input: q("מהי הסיבה העיקרית לעליית המחירים של סחורות?", ["מזג אוויר נעים", "העלייה במחיר הסחורות", "מספר ימי חופשה", "גודל העיר"], 1),
    expected: exp(["KEY_STEM_LEXICAL_OVERLAP"], [], {
      knownMiss: { codes: ["KEY_STEM_LEXICAL_OVERLAP"], kind: "HEURISTIC_GAP", reason: "Only exact prefix-stripped tokens match; inflection/morphology (מחיר/המחירים, עלייה/עליית) is not unified, so overlap counts 1 < 2." },
    }),
  },

  // ---- Weak: grammatical / style cue (no implemented check) ----
  {
    id: "WEAK-GRAMMAR-CUE-EN-01", scope: "ITEM", tags: ["weak", "english", "grammatical-cue"],
    description: "Stem ends with the article 'an'; only the key starts with a vowel (grammatical cue).",
    input: q("A plant that lives in water is called an", ["Cactus", "Algae", "Moss", "Fern"], 1),
    expected: exp(["ARTICLE_MISMATCH"], [], {
      knownMiss: { codes: ["ARTICLE_MISMATCH"], kind: "NOT_IMPLEMENTED", reason: "ARTICLE_MISMATCH is a documented but unimplemented code (AE-029)." },
    }),
  },
  {
    id: "WEAK-STYLE-CUE-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "style-cue"],
    description: "Key is the only complete sentence with a final period; distractors are bare nouns (style outlier cue).",
    input: q("איזה פריט משמש לכתיבה על דף נייר?", ["עט", "שולחן", "הוא משמש לכתיבה על דף נייר ולרישום הערות.", "כיסא"], 2),
    expected: exp(["OPTION_STYLE_OUTLIER", "KEY_LONGEST_OPTION", "OPTION_LENGTH_IMBALANCE", "KEY_STEM_LEXICAL_OVERLAP"], [], {
      knownMiss: { codes: ["OPTION_STYLE_OUTLIER"], kind: "NOT_IMPLEMENTED", reason: "OPTION_STYLE_OUTLIER is a documented but unimplemented code (AE-029); the length and leakage checks fire only as incidental partial signals." },
    }),
  },

  // ---- Weak: bad all/none constructions ----
  {
    id: "WEAK-ALLABOVE-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "all-of-the-above"],
    description: "Option 'כל התשובות נכונות'.",
    input: q("אילו מהבאים הם פירות הדר נפוצים?", ["תפוז", "לימון", "אשכולית", "כל התשובות נכונות"], 3),
    expected: exp(["OPTION_ALL_OF_ABOVE"], ["OPTION_NONE_OF_ABOVE"]),
  },
  {
    id: "WEAK-ALLABOVE-HE-02", scope: "ITEM", tags: ["weak", "hebrew", "all-of-the-above", "variant"],
    description: "Option 'כולן נכונות' (variant wording).",
    input: q("אילו מהבאים הם כלי נגינה מוכרים בתזמורת?", ["כינור", "חליל", "תוף", "כולן נכונות"], 3),
    expected: exp(["OPTION_ALL_OF_ABOVE"], ["OPTION_NONE_OF_ABOVE"]),
  },
  {
    id: "WEAK-ALLABOVE-EN-01", scope: "ITEM", tags: ["weak", "english", "all-of-the-above"],
    description: "Option 'ALL OF THE ABOVE.' in upper case with punctuation.",
    input: q("Which of these are primary colors in painting?", ["Red", "Blue", "Yellow", "ALL OF THE ABOVE."], 3),
    expected: exp(["OPTION_ALL_OF_ABOVE"], ["OPTION_NONE_OF_ABOVE"]),
  },
  {
    id: "WEAK-NONEABOVE-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "none-of-the-above"],
    description: "Option 'אף אחת מהתשובות'.",
    input: q("איזה מהבאים הוא כוכב לכת במערכת השמש?", ["נפטון", "כדור הארץ", "שבתאי", "אף אחת מהתשובות"], 0),
    expected: exp(["OPTION_NONE_OF_ABOVE"], ["OPTION_ALL_OF_ABOVE"]),
  },
  {
    id: "WEAK-NONEABOVE-EN-01", scope: "ITEM", tags: ["weak", "english", "none-of-the-above"],
    description: "Option 'None of these'.",
    input: q("Which of these is a mammal that lives in the sea?", ["Whale", "Shark", "Tuna", "None of these"], 0),
    expected: exp(["OPTION_NONE_OF_ABOVE"], ["OPTION_ALL_OF_ABOVE"]),
  },
  {
    id: "WEAK-COMBINATION-EN-01", scope: "ITEM", tags: ["weak", "english", "combination-reference"],
    description: "Option 'Both A and B' (combination reference, also an all-of-the-above relative).",
    input: q("Which of these animals are reptiles?", ["Lizard", "Snake", "Both A and B", "Frog"], 2),
    expected: exp(["OPTION_COMBINATION_REFERENCE"], [], {
      knownMiss: { codes: ["OPTION_COMBINATION_REFERENCE"], kind: "NOT_IMPLEMENTED", reason: "OPTION_COMBINATION_REFERENCE is a documented but unimplemented code (AE-029)." },
    }),
  },

  // ---- Negative wording ----
  {
    id: "WEAK-NEGATION-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "negative-stem"],
    description: "Hebrew negative stem 'איזה מהבאים אינו ...'.",
    input: q("איזה מהבאים אינו פרי הגדל על עץ?", ["תפוח", "אגס", "גזר", "שזיף"], 2),
    expected: exp(["STEM_NEGATIVE_WORDING"], []),
  },
  {
    id: "WEAK-NEGATION-HE-PREFIX-01", scope: "ITEM", tags: ["weak", "hebrew", "negative-stem", "prefix"],
    description: "Negation with attached relativizer: 'שלא'.",
    input: q("בחרו את החיה שלא חיה במים בדרך כלל.", ["דג", "דולפין", "פרה", "כריש"], 2),
    expected: exp(["STEM_NEGATIVE_WORDING"], []),
  },
  {
    id: "WEAK-NEGATION-EN-01", scope: "ITEM", tags: ["weak", "english", "negative-stem"],
    description: "English 'EXCEPT' in the stem.",
    input: q("All of these are fruits EXCEPT which one?", ["Apple", "Carrot", "Pear", "Plum"], 1),
    expected: exp(["STEM_NEGATIVE_WORDING"], []),
  },
  {
    id: "FP-NEGATION-HE-HUTZ-01", scope: "ITEM", tags: ["clean", "hebrew", "false-positive-guard", "negation-near-miss"],
    description: "'מדיניות חוץ' (foreign policy): 'חוץ' here is a noun, not negation.",
    input: q("איזה גוף ממשלתי מנהל את הקשרים עם מדינות אחרות בנושא מדיניות חוץ?", ["משרד החוץ", "משרד התחבורה", "משרד הבריאות", "משרד החקלאות"], 0),
    expected: clean({
      forbiddenCodes: ["STEM_NEGATIVE_WORDING"],
      knownFalsePositive: { codes: ["STEM_NEGATIVE_WORDING"], reason: "'חוץ' is in the Hebrew negation list (as in 'חוץ מ'), but also means 'outside/foreign' in a noun phrase." },
    }),
  },
  {
    id: "FP-NEGATION-EN-LEAST-01", scope: "ITEM", tags: ["clean", "english", "false-positive-guard", "negation-near-miss"],
    description: "'at least' is not negative wording.",
    input: q("A polygon needs at least how many straight sides?", ["Two", "Three", "Five", "Eight"], 1),
    expected: clean({
      forbiddenCodes: ["STEM_NEGATIVE_WORDING"],
      knownFalsePositive: { codes: ["STEM_NEGATIVE_WORDING"], reason: "'least' is in the English negation list (for 'LEAST likely'), but 'at least' is not negative wording." },
    }),
  },
  {
    id: "WEAK-STEM-SHORT-01", scope: "ITEM", tags: ["weak", "hebrew", "fragment-stem"],
    description: "Fragment stem with fewer than four words.",
    input: q("בירת צרפת?", ["פריז", "ליון", "ניס", "לילה"], 0),
    expected: exp(["STEM_TOO_SHORT"], []),
  },

  // ---- Duplicates and normalization ----
  {
    id: "DUP-EXACT-01", scope: "ITEM", tags: ["weak", "hebrew", "duplicate-answers", "structural"],
    description: "Two options with identical text.",
    input: q("איזה חודש מגיע מיד אחרי חודש מרץ?", ["אפריל", "מאי", "אפריל", "יוני"], 0),
    expected: exp(["OPTION_DUPLICATE_EXACT"], ["OPTION_DUPLICATE_NORMALIZED"]),
  },
  {
    id: "DUP-NORM-CASE-PUNCT-01", scope: "ITEM", tags: ["weak", "english", "duplicate-answers", "normalized"],
    description: "'Photosynthesis.' vs 'photosynthesis' (case and terminal punctuation).",
    input: q("Which process lets plants make sugar from light?", ["Photosynthesis.", "Respiration", "photosynthesis", "Digestion"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-NIQQUD-01", scope: "ITEM", tags: ["weak", "hebrew", "duplicate-answers", "normalized", "niqqud"],
    description: "Same word with and without niqqud.",
    input: q("איזו מילה משמשת כברכה בפגישה בין אנשים?", ["שָׁלוֹם", "תודה", "שלום", "סליחה"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-FINAL-LETTER-01", scope: "ITEM", tags: ["weak", "hebrew", "duplicate-answers", "normalized", "final-letters"],
    description: "Same word with final-form vs medial-form mem ('ירושלים' vs 'ירושלימ').",
    input: q("איזו עיר היא בירת מדינת ישראל?", ["ירושלים", "חיפה", "ירושלימ", "אילת"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-GERSHAYIM-01", scope: "ITEM", tags: ["weak", "hebrew", "duplicate-answers", "normalized", "gershayim"],
    description: "Acronym with ASCII quote vs gershayim (צה\"ל vs צה״ל).",
    input: q("איזה גוף אחראי על הגנת המדינה מפני איומים חיצוניים?", ["צה\"ל", "משטרה", "צה״ל", "כבאות"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-MAQAF-01", scope: "ITEM", tags: ["weak", "hebrew", "duplicate-answers", "normalized", "maqaf"],
    description: "Maqaf vs hyphen (בית־ספר vs בית-ספר).",
    input: q("איפה לומדים ילדים בגילאי שש עד שתים עשרה?", ["בית־ספר", "מסעדה", "בית-ספר", "תחנה"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-NFD-01", scope: "ITEM", tags: ["weak", "english", "duplicate-answers", "normalized", "unicode-nfc-nfd"],
    description: "Composed vs decomposed 'café' (NFC vs NFD).",
    input: q("Which word names a small coffee shop?", ["café", "bakery", "café", "market"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-DIGITS-01", scope: "ITEM", tags: ["weak", "mixed-script", "duplicate-answers", "normalized", "numerals"],
    description: "Eastern Arabic digit vs ASCII digit for the same number ('٣' vs '3').",
    input: q("כמה צלעות יש במשולש רגיל?", ["٣", "4", "3", "5"], 2),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-ZEROWIDTH-01", scope: "ITEM", tags: ["adversarial", "hebrew", "duplicate-answers", "normalized", "zero-width"],
    description: "Option with an embedded zero-width space duplicates a visible word.",
    input: q("איזו מילה משמשת כברכה בפגישה בין אנשים?", ["שלום", "תודה", "של​ום", "סליחה"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED", "OPTION_WHITESPACE_ANOMALY"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "DUP-NORM-BIDI-01", scope: "ITEM", tags: ["adversarial", "hebrew", "duplicate-answers", "normalized", "bidi"],
    description: "Option wrapped in RLM/LRM bidi marks duplicates a plain word (pasted-text artifact).",
    input: q("איזה צבע מתקבל מערבוב כחול עם צהוב?", ["ירוק", "‏ירוק‎", "סגול", "כתום"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED", "OPTION_WHITESPACE_ANOMALY"], ["OPTION_DUPLICATE_EXACT"]),
  },
  {
    id: "ADV-INVISIBLE-OTHER-01", scope: "ITEM", tags: ["adversarial", "hebrew", "invisible-characters"],
    description: "Options carry a BOM, a soft hyphen and a word joiner (invisible characters outside the zero-width/bidi ranges the anomaly check lists).",
    input: q("איזה חודש מגיע מיד אחרי חודש מרץ?", ["﻿אפריל", "מא­י", "פברו⁠אר", "יוני"], 0),
    expected: exp(["OPTION_WHITESPACE_ANOMALY"], []),
  },
  {
    id: "ADV-HOMOGLYPH-01", scope: "ITEM", tags: ["adversarial", "english", "homoglyph", "duplicate-answers"],
    description: "'paypal' vs 'pаypal' (Cyrillic a): visually identical, different code points.",
    input: q("Which brand name is spelled with two letters p?", ["paypal", "market", "pаypal", "banner"], 0),
    expected: exp(["OPTION_DUPLICATE_NORMALIZED"], [], {
      knownMiss: { codes: ["OPTION_DUPLICATE_NORMALIZED"], kind: "HEURISTIC_GAP", reason: "No confusable/homoglyph (UTS #39 skeleton) folding; only NFC, case, niqqud, final letters, quotes, dashes, digits and zero-width/bidi stripping." },
    }),
  },
  {
    id: "OVERLAP-OPTIONS-HE-01", scope: "ITEM", tags: ["weak", "hebrew", "option-overlap"],
    description: "Two options are the same 8-word sentence with one extra word (high token overlap, not equal).",
    input: q("איזו הגדרה מתארת נכון את המושג כוח בפיזיקה?", ["גורם שמשנה את מהירות הגוף או את כיוון תנועתו", "גורם שמשנה את מהירות הגוף או את כיוון תנועתו בפועל", "מקום שבו מאחסנים מים", "סוג של חומר מתכתי"], 0),
    expected: exp(["OPTION_OVERLAP_HIGH"], ["OPTION_DUPLICATE_EXACT", "OPTION_DUPLICATE_NORMALIZED"]),
  },
  {
    id: "OVERLAP-OPTIONS-HE-BOUNDARY-01", scope: "ITEM", tags: ["weak", "hebrew", "option-overlap", "threshold-boundary"],
    description: "Short 5-word option plus one extra word (Jaccard 5/6 = 0.833, just under the 0.85 default): still near-identical to a reader.",
    input: q("איזו הגדרה מתארת נכון את המושג כוח בפיזיקה?", ["גורם שמשנה את מהירות הגוף", "גורם שמשנה את מהירות הגוף בפועל", "מקום שבו מאחסנים מים", "סוג של חומר מתכתי"], 0),
    expected: exp(["OPTION_OVERLAP_HIGH"], [], {
      knownMiss: { codes: ["OPTION_OVERLAP_HIGH"], kind: "HEURISTIC_GAP", reason: "Boundary: Jaccard 0.833 < OPTION_OVERLAP_JACCARD 0.85 for short options; a single extra word on a 5-word option is a large relative change." },
    }),
  },
  {
    id: "WEAK-WHITESPACE-01", scope: "ITEM", tags: ["weak", "hebrew", "whitespace"],
    description: "Leading space and a double space inside options.",
    input: q("איזו עונה באה אחרי הקיץ בלוח השנה?", [" סתיו", "חורף  קר", "קיץ", "אביב"], 0),
    expected: exp(["OPTION_WHITESPACE_ANOMALY"], []),
  },
  {
    id: "WEAK-NO-EXPLANATION-01", scope: "ITEM", tags: ["weak", "hebrew", "explanation"],
    description: "Whitespace-only explanation counts as missing.",
    input: q("איזו עונה באה אחרי הקיץ בלוח השנה?", ["סתיו", "חורף", "אביב", "גשם"], 0, { explanation: "   " }),
    expected: exp(["EXPLANATION_MISSING"], []),
  },

  // ---- Structural / defensive diagnostics ----
  {
    id: "STRUCT-EMPTY-OPTION-01", scope: "ITEM", tags: ["structural", "hebrew"],
    description: "One option is empty/blank.",
    input: q("מהו הצבע של השמיים ביום בהיר?", ["כחול", "   ", "ירוק", "שחור"], 0),
    expected: exp(["OPTION_EMPTY"], []),
  },
  {
    id: "STRUCT-DUP-ID-01", scope: "ITEM", tags: ["structural"],
    description: "Two options share the same id.",
    input: {
      questionType: "SINGLE_CHOICE", prompt: "מהו הצבע של השמיים ביום בהיר?",
      answerOptions: [{ id: "A", content: "כחול" }, { id: "A", content: "ירוק" }, { id: "C", content: "שחור" }, { id: "D", content: "לבן" }],
      correctOptionIds: ["A"], explanation: EXPLANATION,
    },
    expected: exp(["OPTION_ID_DUPLICATE"], []),
  },
  {
    id: "STRUCT-CORRECT-UNKNOWN-01", scope: "ITEM", tags: ["structural"],
    description: "Correct id does not match any option.",
    input: {
      questionType: "SINGLE_CHOICE", prompt: "מהו הצבע של השמיים ביום בהיר?",
      answerOptions: [{ id: "A", content: "כחול" }, { id: "B", content: "ירוק" }, { id: "C", content: "שחור" }],
      correctOptionIds: ["Z"], explanation: EXPLANATION,
    },
    expected: exp(["CORRECT_ID_UNKNOWN"], []),
  },
  {
    id: "STRUCT-SC-TWO-KEYS-01", scope: "ITEM", tags: ["structural", "too-many-correct"],
    description: "SINGLE_CHOICE with two correct ids.",
    input: { ...q("מהו הצבע של השמיים ביום בהיר?", ["כחול", "ירוק", "שחור", "לבן"], 0), correctOptionIds: ["A", "B"] },
    expected: exp(["CORRECT_COUNT_INVALID"], []),
  },
  {
    id: "STRUCT-MC-ALL-CORRECT-01", scope: "ITEM", tags: ["structural", "too-many-correct"],
    description: "MULTIPLE_CHOICE where every option is correct.",
    input: q("אילו מהבאים הם מספרים?", ["אחד", "שניים", "שלושה", "ארבעה"], [0, 1, 2, 3]),
    expected: exp(["CORRECT_COUNT_INVALID"], []),
  },
  {
    id: "STRUCT-ONE-OPTION-01", scope: "ITEM", tags: ["structural"],
    description: "Only one answer option.",
    input: q("מהו הצבע של השמיים ביום בהיר?", ["כחול"], 0),
    expected: exp(["OPTIONS_TOO_FEW"], []),
  },
  {
    id: "STRUCT-EMPTY-STEM-01", scope: "ITEM", tags: ["structural"],
    description: "Stem is only zero-width/bidi characters.",
    input: q("​‏ ", ["כחול", "ירוק", "שחור", "לבן"], 0),
    expected: exp(["STEM_EMPTY"], []),
  },
  {
    id: "STRUCT-TYPE-UNSUPPORTED-01", scope: "ITEM", tags: ["structural", "unsupported-type"],
    description: "Unsupported questionType (TRUE_FALSE).",
    input: q("השמיים כחולים ביום בהיר.", ["נכון", "לא נכון"], 0, { type: "TRUE_FALSE" }),
    expected: exp(["QUESTION_TYPE_UNSUPPORTED"], ["CORRECT_COUNT_INVALID"]),
  },
  {
    id: "STRUCT-TYPE-CASE-01", scope: "ITEM", tags: ["structural", "unsupported-type"],
    description: "Wrong-case questionType 'single_choice'.",
    input: q("מהו הצבע של השמיים ביום בהיר?", ["כחול", "ירוק", "שחור", "לבן"], 0, { type: "single_choice" }),
    expected: exp(["QUESTION_TYPE_UNSUPPORTED"], []),
  },
  {
    id: "ADV-CORRECT-IDS-TOO-MANY-01", scope: "ITEM", tags: ["adversarial", "too-many-correct", "bounded"],
    description: "60 correct ids (above the cap): explicit CORRECT_IDS_TOO_MANY, no silent truncation.",
    input: {
      ...q("מהו הצבע של השמיים ביום בהיר?", ["כחול", "ירוק", "שחור", "לבן"], 0),
      correctOptionIds: Array.from({ length: 60 }, (_, i) => `K${i}`),
    },
    expected: exp(["CORRECT_IDS_TOO_MANY"], ["CORRECT_COUNT_INVALID", "CORRECT_ID_UNKNOWN"]),
  },
  {
    id: "ADV-OPTIONS-TOO-MANY-01", scope: "ITEM", tags: ["adversarial", "bounded"],
    description: "60 options (above the cap): explicit OPTIONS_TOO_MANY.",
    input: {
      questionType: "SINGLE_CHOICE", prompt: "מהו המספר הנכון מבין כל המספרים הבאים?",
      answerOptions: Array.from({ length: 60 }, (_, i) => ({ id: `O${i}`, content: `מספר ${i}` })),
      correctOptionIds: ["O0"], explanation: EXPLANATION,
    },
    expected: exp(["OPTIONS_TOO_MANY"], []),
  },
  {
    id: "ADV-HUGE-PROMPT-01", scope: "ITEM", tags: ["adversarial", "bounded", "huge-string"],
    description: "Prompt of ~6000 characters: analysed on a prefix with explicit TEXT_TRUNCATED.",
    input: q("מילה ".repeat(1200), ["כחול", "ירוק", "שחור", "לבן"], 0),
    expected: exp(["TEXT_TRUNCATED"], []),
  },
  {
    id: "ADV-HUGE-OPTION-01", scope: "ITEM", tags: ["adversarial", "bounded", "huge-string"],
    description: "One option of ~6000 characters: explicit TEXT_TRUNCATED.",
    input: q("מהו הצבע של השמיים ביום בהיר?", ["כחול", "ירוק ".repeat(1200), "שחור", "לבן"], 0),
    expected: exp(["TEXT_TRUNCATED"], []),
  },
  {
    id: "ADV-GARBAGE-INPUT-01", scope: "ITEM", tags: ["adversarial", "unreadable", "defensive"],
    description: "Non-object input (null): never throws; reports defensive structural diagnostics.",
    input: null,
    expected: exp(["STEM_EMPTY", "QUESTION_TYPE_UNSUPPORTED", "OPTIONS_TOO_FEW"], []),
  },
  {
    id: "ADV-THROWING-INPUT-01", scope: "ITEM", tags: ["adversarial", "unreadable", "defensive"],
    description: "Object whose property reads throw: INPUT_UNREADABLE, never an exception.",
    input: THROWING,
    expected: exp(["INPUT_UNREADABLE"], []),
  },

  // ---- Semantic-only judgments (linter result is NOT asserted) ----
  {
    id: "SEM-AMBIGUOUS-01", scope: "ITEM", tags: ["semantic", "hebrew", "ambiguous-question"],
    description: "Two options are defensible as the key; structurally the item is flawless.",
    input: q("איזו חיה נחשבת לגדולה ביותר בקרב היונקים?", ["לווייתן כחול", "פיל אפריקאי", "ג'ירפה", "היפופוטם"], 0),
    expected: exp([], [], {
      semanticExpectation: "SEMANTIC_EXPECTATION: 'largest' is ambiguous (by mass, length, or on land): the linter passes it; a human or critic must flag the two defensible keys.",
    }),
  },
  {
    id: "SEM-DISTRACTORS-PLAUSIBLE-01", scope: "ITEM", tags: ["semantic", "hebrew", "plausible-distractors"],
    description: "Plausible adjacent-concept distractors.",
    input: q("איזו בירה נמצאת על גדות נהר התמזה?", ["לונדון", "פריז", "ברלין", "רומא"], 0),
    expected: exp([], [], {
      semanticExpectation: "SEMANTIC_EXPECTATION: distractors are other capitals, so they are plausible to a learner; plausibility is not computable by the linter.",
    }),
  },
  {
    id: "SEM-DISTRACTORS-IMPLAUSIBLE-01", scope: "ITEM", tags: ["semantic", "hebrew", "implausible-distractors"],
    description: "Implausible, joke-like distractors.",
    input: q("איזו בירה נמצאת על גדות נהר התמזה?", ["לונדון", "פיצה", "כחול", "שבע"], 0),
    expected: exp([], [], {
      semanticExpectation: "SEMANTIC_EXPECTATION: distractors are not alternatives a learner would consider; the item gives away the key. Linter sees balanced short options and stays silent.",
    }),
  },
  {
    id: "SEM-EQUIVALENT-STEMS-NOTE-01", scope: "SET", tags: ["semantic", "hebrew", "assessment-equivalent"],
    description: "Two paraphrased stems assessing the same fact (assessment-equivalent) inside an otherwise clean set.",
    set: cleanSet(BALANCED_POSITIONS, {
      11: q("איזו עיר משמשת מרכז השלטון באיטליה כיום?", ["מילאנו", "נאפולי", "רומא", "טורינו"], 2),
    }),
    expected: exp([], ["DUPLICATE_STEM_EXACT", "DUPLICATE_STEM_NORMALIZED"], {
      semanticExpectation: "SEMANTIC_EXPECTATION: item 0 and item 11 assess the same fact (assessment-equivalent paraphrase); token similarity is far below NEAR_DUPLICATE_STEM, so detection needs a semantic critic.",
    }),
  },
];

// ---------------------------------------------------------------------------------------------
// SET cases
// ---------------------------------------------------------------------------------------------
const NEAR_BASE = "איזה גז חיוני לנשימה של בני אדם בכל יום רגיל בבית?";
const NEAR_VARIANT = "איזה גז חיוני לנשימה של בני אדם בכל יום רגיל בחוץ?";

const setCases: GoldenCase[] = [
  {
    id: "SET-BALANCED-CLEAN-01", scope: "SET", tags: ["set", "clean", "answer-positions", "balanced"],
    description: "12 distinct clean items, key positions balanced with no run: no set warning at all.",
    set: cleanSet(),
    expected: clean({ forbiddenCodes: ["KEY_POSITION_IMBALANCE", "KEY_POSITION_RUN", "SET_KEY_LENGTH_BIAS", "SET_TOO_SMALL", "STEM_TEMPLATE_REPEATED"] }),
  },
  {
    id: "SET-BIASED-POSITION-01", scope: "SET", tags: ["set", "answer-positions", "imbalance"],
    description: "Key in position B for 5 of 12 items (no run longer than 1).",
    set: cleanSet([1, 0, 1, 2, 1, 3, 1, 0, 1, 2, 3, 0]),
    expected: exp(["KEY_POSITION_IMBALANCE"], ["KEY_POSITION_RUN"]),
  },
  {
    id: "SET-RUN-POSITION-01", scope: "SET", tags: ["set", "answer-positions", "run"],
    description: "Key in position C for four consecutive items; overall shares stay balanced.",
    set: cleanSet([1, 2, 2, 2, 2, 0, 3, 1, 3, 0, 1, 3]),
    expected: exp(["KEY_POSITION_RUN"], ["KEY_POSITION_IMBALANCE"]),
  },
  {
    id: "SET-TOO-SMALL-01", scope: "SET", tags: ["set", "small"],
    description: "Only 5 items: SET_TOO_SMALL, and position statistics are suppressed.",
    set: cleanSet().slice(0, 5),
    expected: exp(["SET_TOO_SMALL"], ["KEY_POSITION_IMBALANCE", "KEY_POSITION_RUN", "SET_KEY_LENGTH_BIAS", "STEM_TEMPLATE_REPEATED"]),
  },
  {
    id: "SET-MIN-SIZE-BOUNDARY-01", scope: "SET", tags: ["set", "small", "boundary"],
    description: "Exactly 8 items (the current minimum): no SET_TOO_SMALL.",
    set: cleanSet().slice(0, 8),
    expected: clean({ forbiddenCodes: ["SET_TOO_SMALL"] }),
  },
  {
    id: "SET-DUP-STEM-EXACT-01", scope: "SET", tags: ["set", "duplicate-questions", "exact"],
    description: "Two items with an identical stem.",
    set: cleanSet(BALANCED_POSITIONS, { 11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), POOL[0].prompt) }),
    expected: exp(["DUPLICATE_STEM_EXACT"], ["DUPLICATE_STEM_NORMALIZED", "NEAR_DUPLICATE_STEM"]),
  },
  {
    id: "SET-DUP-STEM-NORMALIZED-01", scope: "SET", tags: ["set", "duplicate-questions", "normalized"],
    description: "Stems differ only by terminal punctuation and spacing.",
    set: cleanSet(BALANCED_POSITIONS, { 11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), "מהי  בירתה של מדינת איטליה לפי המפה הפוליטית") }),
    expected: exp(["DUPLICATE_STEM_NORMALIZED"], ["DUPLICATE_STEM_EXACT", "NEAR_DUPLICATE_STEM"]),
  },
  {
    id: "SET-DUP-STEM-NORMALIZED-NIQQUD-01", scope: "SET", tags: ["set", "duplicate-questions", "normalized", "niqqud"],
    description: "Stems differ only by niqqud on one word.",
    set: cleanSet(BALANCED_POSITIONS, { 11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), "מהי בִּירָתָהּ של מדינת איטליה לפי המפה הפוליטית?") }),
    expected: exp(["DUPLICATE_STEM_NORMALIZED"], ["DUPLICATE_STEM_EXACT"]),
  },
  {
    id: "SET-NEAR-DUP-STEM-01", scope: "SET", tags: ["set", "duplicate-questions", "near-duplicate"],
    description: "Two long stems differ in a single word.",
    set: cleanSet(BALANCED_POSITIONS, {
      2: withPrompt(poolItem(POOL[2], BALANCED_POSITIONS[2]), NEAR_BASE),
      11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), NEAR_VARIANT),
    }),
    expected: exp(["NEAR_DUPLICATE_STEM"], ["DUPLICATE_STEM_EXACT", "DUPLICATE_STEM_NORMALIZED"]),
  },
  {
    id: "SET-NEAR-DUP-REORDERED-01", scope: "SET", tags: ["set", "duplicate-questions", "near-duplicate", "paraphrase"],
    description: "The same stem with clauses reordered (identical token set).",
    set: cleanSet(BALANCED_POSITIONS, { 11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), "לפי המפה הפוליטית, מהי בירתה של מדינת איטליה?") }),
    expected: exp(["NEAR_DUPLICATE_STEM"], ["DUPLICATE_STEM_EXACT", "DUPLICATE_STEM_NORMALIZED"]),
  },
  {
    id: "SET-NEAR-DUP-INFLECTION-01", scope: "SET", tags: ["set", "duplicate-questions", "near-duplicate", "inflection"],
    description: "Stems differ only by gender/number inflections of several words (same assessed fact).",
    set: cleanSet(BALANCED_POSITIONS, {
      2: withPrompt(poolItem(POOL[2], BALANCED_POSITIONS[2]), "איזה חיה נחשבת לבעלת חיים נפוצה בבית אצל משפחות קטנות?"),
      11: withPrompt(poolItem(POOL[11], BALANCED_POSITIONS[11]), "איזו חיות נחשבות לבעלות חיים נפוצים בבתים אצל משפחה קטנה?"),
    }),
    expected: exp(["NEAR_DUPLICATE_STEM"], ["DUPLICATE_STEM_EXACT", "DUPLICATE_STEM_NORMALIZED"], {
      knownMiss: { codes: ["NEAR_DUPLICATE_STEM"], kind: "HEURISTIC_GAP", reason: "Gender/number inflections change the tokens, so Jaccard falls below the threshold (documented expected miss, ASSESSMENT_ENGINE section 19.4)." },
    }),
  },
  {
    id: "SET-LENGTH-BIAS-01", scope: "SET", tags: ["set", "longest-answer-bias"],
    description: "The key is strictly the longest option in 7 of 12 items, each by only a few characters (no item-level warning).",
    set: cleanSet(BALANCED_POSITIONS, {}, (i) => (i < 7 ? " בעיקר" : "")),
    expected: exp(["SET_KEY_LENGTH_BIAS"], ["KEY_LONGEST_OPTION"]),
  },
  {
    id: "SET-STEM-TEMPLATE-01", scope: "SET", tags: ["set", "template", "repeated-stem"],
    description: "6 of 12 stems open with the same three words.",
    set: cleanSet(BALANCED_POSITIONS, {
      0: withPrompt(poolItem(POOL[0], BALANCED_POSITIONS[0]), "מהי ההגדרה הנכונה של עיר בירה במדינה מודרנית?"),
      1: withPrompt(poolItem(POOL[1], BALANCED_POSITIONS[1]), "מהי ההגדרה הנכונה של ריבוע בגיאומטריה בסיסית?"),
      2: withPrompt(poolItem(POOL[2], BALANCED_POSITIONS[2]), "מהי ההגדרה הנכונה של גז בכימיה בסיסית?"),
      3: withPrompt(poolItem(POOL[3], BALANCED_POSITIONS[3]), "מהי ההגדרה הנכונה של כיוון בגיאוגרפיה כללית?"),
      4: withPrompt(poolItem(POOL[4], BALANCED_POSITIONS[4]), "מהי ההגדרה הנכונה של מכפלה בחשבון רגיל?"),
      5: withPrompt(poolItem(POOL[5], BALANCED_POSITIONS[5]), "מהי ההגדרה הנכונה של חיית בית אצל משפחה?"),
    }),
    expected: exp(["STEM_TEMPLATE_REPEATED"], ["NEAR_DUPLICATE_STEM"]),
  },
  {
    id: "SET-TOPIC-UNDERCOVERAGE-01", scope: "SET", tags: ["set", "semantic", "topic-coverage", "unsupported"],
    description: "A clean 12-item set where (by assumption) every item is about one narrow topic and other required topics are absent.",
    set: cleanSet(),
    expected: exp([], [], {
      semanticExpectation: "SEMANTIC_EXPECTATION: topic under-coverage / TOPIC_CONCENTRATION needs topic or objective metadata, which does not exist today; the linter cannot see topics.",
    }),
  },
  {
    id: "SET-RECALL-OVERUSE-01", scope: "SET", tags: ["set", "semantic", "cognitive-level", "unsupported"],
    description: "A clean 12-item set made of pure fact-recall questions with no application or reasoning items.",
    set: cleanSet(),
    expected: exp([], [], {
      semanticExpectation: "SEMANTIC_EXPECTATION: overuse of recall-level questions (RECALL_EXCESS) needs cognitive-level metadata; unsupported by the linter.",
    }),
  },
  {
    id: "SET-STRESS-TRUNCATED-01", scope: "SET", tags: ["set", "adversarial", "bounded", "stress"],
    description: "2001 near-identical-looking items: explicit SET_ITEMS_TRUNCATED and SET_ANALYSIS_TRUNCATED, bounded work.",
    set: Array.from({ length: 2001 }, (_, i) =>
      q(`שאלה מספר ${i} על נושא כלשהו בחשבון`, ["כן", "לא", "אולי", "אין"], i % 4),
    ),
    expected: exp(["SET_ITEMS_TRUNCATED", "SET_ANALYSIS_TRUNCATED"], []),
  },
];

export const GOLDEN_DATASET_V0_1: GoldenDataset = {
  version: "0.1",
  cases: [...itemCases, ...setCases],
};
