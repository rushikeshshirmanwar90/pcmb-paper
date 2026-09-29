import { FilterOptions, FilterState, Paper, Question } from "@/types/pcmb";

// Base API URL for @papers backend (can be configured)
const API_BASE_URL = "https://papers-jet.vercel.app/api";

export const MOCK_QUESTIONS: Question[] = [
  // --- FOUNDATION CLASS 9 ---
  {
    _id: "q-found-9-1",
    questionNumber: 1,
    examCategory: "Foundation",
    standard: "9th",
    subject: "Science",
    chapter: "Motion",
    topic: "Distance and Displacement",
    difficulty: "Easy",
    questionText: "A person travels along a circular path of radius $R = 7\\text{ m}$. What is the displacement after completing half a circle?",
    optionA: "$7\\text{ m}$",
    optionB: "$14\\text{ m}$",
    optionC: "$22\\text{ m}$",
    optionD: "$44\\text{ m}$",
    correctAnswer: "B",
    explanation: "Displacement is the shortest distance between initial and final position. After half a revolution on a circle of radius $R$, the displacement equals the diameter $2R = 2 \\times 7\\text{ m} = 14\\text{ m}$.",
    source: "Foundation Grade 9 Science",
  },
  {
    _id: "q-found-9-2",
    questionNumber: 2,
    examCategory: "Foundation",
    standard: "9th",
    subject: "Mathematics",
    chapter: "Real Numbers",
    topic: "Irrational Numbers & Identities",
    difficulty: "Mid",
    questionText: "Simplify the expression: $(\\sqrt{5} + \\sqrt{2})(\\sqrt{5} - \\sqrt{2})$.",
    optionA: "$3$",
    optionB: "$7$",
    optionC: "$\\sqrt{3}$",
    optionD: "$5 - 2\\sqrt{10}$",
    correctAnswer: "A",
    explanation: "Using algebraic identity $(a+b)(a-b) = a^2 - b^2$:\n$(\\sqrt{5})^2 - (\\sqrt{2})^2 = 5 - 2 = 3$.",
    source: "Foundation Grade 9 Mathematics",
  },
  {
    _id: "q-found-9-3",
    questionNumber: 3,
    examCategory: "Foundation",
    standard: "9th",
    subject: "Science",
    chapter: "Force and Laws of Motion",
    topic: "Newton's Second Law",
    difficulty: "Hard",
    questionText: "A force of $5\\text{ N}$ gives a mass $m_1$ an acceleration of $10\\text{ m/s}^2$ and a mass $m_2$ an acceleration of $20\\text{ m/s}^2$. What acceleration would it give if both masses were tied together?",
    optionA: "$5\\text{ m/s}^2$",
    optionB: "$6.67\\text{ m/s}^2$",
    optionC: "$15\\text{ m/s}^2$",
    optionD: "$30\\text{ m/s}^2$",
    correctAnswer: "B",
    explanation: "Mass $m_1 = \\frac{F}{a_1} = \\frac{5}{10} = 0.5\\text{ kg}$.\nMass $m_2 = \\frac{F}{a_2} = \\frac{5}{20} = 0.25\\text{ kg}$.\nTotal mass $M = m_1 + m_2 = 0.75\\text{ kg}$.\nCombined acceleration $a = \\frac{F}{M} = \\frac{5}{0.75} = \\frac{20}{3} \\approx 6.67\\text{ m/s}^2$.",
    source: "Foundation Olympiad 9th",
  },

  // --- FOUNDATION CLASS 10 ---
  {
    _id: "q-found-10-1",
    questionNumber: 1,
    examCategory: "Foundation",
    standard: "10th",
    subject: "Mathematics",
    chapter: "Real Numbers",
    topic: "Euclid's Division & HCF",
    difficulty: "Easy",
    questionText: "If two positive integers $a$ and $b$ are written as $a = x^3 y^2$ and $b = x y^3$, where $x, y$ are prime numbers, then $\\text{HCF}(a, b)$ is:",
    optionA: "$x y$",
    optionB: "$x y^2$",
    optionC: "$x^3 y^3$",
    optionD: "$x^2 y^2$",
    correctAnswer: "B",
    explanation: "HCF takes the lowest power of common prime factors: $x^{\\min(3,1)} \\times y^{\\min(2,3)} = x^1 y^2 = x y^2$.",
    source: "CBSE Class 10 Foundation",
  },
  {
    _id: "q-found-10-2",
    questionNumber: 2,
    examCategory: "Foundation",
    standard: "10th",
    subject: "Physics",
    chapter: "Electricity",
    topic: "Ohm's Law & Resistance",
    difficulty: "Mid",
    questionText: "A wire of resistance $R$ is cut into five equal parts. These parts are then connected in parallel. If the equivalent resistance of this combination is $R'$, then the ratio $R/R'$ is:",
    optionA: "$1/25$",
    optionB: "$1/5$",
    optionC: "$5$",
    optionD: "$25$",
    correctAnswer: "D",
    explanation: "Each part has resistance $R/5$.\nWhen 5 resistors of $R/5$ are in parallel:\n$\\frac{1}{R'} = \\frac{5}{R/5} + \\frac{5}{R/5} + \\dots (5 \\text{ times}) = 5 \\times \\frac{5}{R} = \\frac{25}{R}$.\nThus $R' = \\frac{R}{25}$, so $\\frac{R}{R'} = 25$.",
    source: "NCERT Class 10 Physics",
  },
  {
    _id: "q-found-10-3",
    questionNumber: 3,
    examCategory: "Foundation",
    standard: "10th",
    subject: "Chemistry",
    chapter: "Acids, Bases and Salts",
    topic: "pH Scale & Neutralization",
    difficulty: "Hard",
    questionText: "An aqueous solution turns red litmus paper blue. Excess addition of which solution would reverse the change?",
    optionA: "Baking powder",
    optionB: "Lime",
    optionC: "Ammonium hydroxide solution",
    optionD: "Hydrochloric acid",
    correctAnswer: "D",
    explanation: "Turning red litmus blue indicates the solution is basic. To reverse the change (make it acidic so blue litmus turns red), an excess of acid such as Hydrochloric acid ($HCl$) must be added.",
    source: "Class 10 Science Foundation",
  },

  // --- JEE / NEET CLASS 11 ---
  {
    _id: "q-jee-11-1",
    questionNumber: 1,
    examCategory: "JEE/NEET",
    standard: "11th",
    subject: "Physics",
    chapter: "Kinematics",
    topic: "Relative Motion & Projectiles",
    difficulty: "Mid",
    questionText: "A projectile is thrown with an initial velocity $\\vec{v} = 6\\hat{i} + 8\\hat{j}\\text{ m/s}$. Taking $g = 10\\text{ m/s}^2$, the horizontal range of the projectile is:",
    optionA: "$4.8\\text{ m}$",
    optionB: "$9.6\\text{ m}$",
    optionC: "$12.0\\text{ m}$",
    optionD: "$14.4\\text{ m}$",
    correctAnswer: "B",
    explanation: "Here $u_x = 6\\text{ m/s}$ and $u_y = 8\\text{ m/s}$.\nTime of flight $T = \\frac{2 u_y}{g} = \\frac{2 \\times 8}{10} = 1.6\\text{ s}$.\nHorizontal Range $R = u_x \\times T = 6 \\times 1.6 = 9.6\\text{ m}$.",
    source: "JEE Main 2021",
  },
  {
    _id: "q-jee-11-2",
    questionNumber: 2,
    examCategory: "JEE/NEET",
    standard: "11th",
    subject: "Mathematics",
    chapter: "Trigonometry",
    topic: "Trigonometric Ratios & Identities",
    difficulty: "Easy",
    questionText: "If $\\tan \\theta = \\frac{3}{4}$ and $\\theta$ lies in the third quadrant, what is the value of $\\sin \\theta + \\cos \\theta$?",
    optionA: "$-\\frac{7}{5}$",
    optionB: "$\\frac{1}{5}$",
    optionC: "$-\\frac{1}{5}$",
    optionD: "$\\frac{7}{5}$",
    correctAnswer: "A",
    explanation: "In the 3rd quadrant, both sine and cosine are negative.\nGiven $\\tan \\theta = 3/4$, hypotenuse = 5.\n$\\sin \\theta = -3/5$ and $\\cos \\theta = -4/5$.\n$\\sin \\theta + \\cos \\theta = -3/5 - 4/5 = -7/5$.",
    source: "JEE Main Practice",
  },
  {
    _id: "q-jee-11-3",
    questionNumber: 3,
    examCategory: "JEE/NEET",
    standard: "11th",
    subject: "Chemistry",
    chapter: "Chemical Bonding",
    topic: "VSEPR Theory & Hybridization",
    difficulty: "Hard",
    questionText: "Which of the following species has T-shaped molecular geometry?",
    optionA: "$\\text{BF}_3$",
    optionB: "$\\text{ClF}_3$",
    optionC: "$\\text{NH}_3$",
    optionD: "$\\text{PCl}_5$",
    correctAnswer: "B",
    explanation: "$\\text{ClF}_3$ has 7 valence electrons on Cl. 3 form single bonds with F, leaving 2 lone pairs. Steric number = $3 + 2 = 5$ ($sp^3d$ hybridization). The two lone pairs occupy equatorial positions, resulting in a T-shaped molecular geometry.",
    source: "NEET 2020",
  },

  // --- JEE / NEET CLASS 12 ---
  {
    _id: "q-jee-12-1",
    questionNumber: 1,
    examCategory: "JEE/NEET",
    standard: "12th",
    subject: "Physics",
    chapter: "Electrostatics",
    topic: "Electric Field & Gauss Law",
    difficulty: "Hard",
    questionText: "Two point charges $+q$ and $-q$ are placed at a distance $2a$ apart. The electric potential at the midpoint between them is:",
    optionA: "$\\frac{1}{4\\pi \\varepsilon_0} \\frac{2q}{a}$",
    optionB: "Zero",
    optionC: "$\\frac{1}{4\\pi \\varepsilon_0} \\frac{q}{a^2}$",
    optionD: "$\\frac{1}{4\\pi \\varepsilon_0} \\frac{q}{2a}$",
    correctAnswer: "B",
    explanation: "Potential at midpoint due to $+q$ is $V_1 = \\frac{q}{4\\pi \\varepsilon_0 a}$.\nPotential at midpoint due to $-q$ is $V_2 = -\\frac{q}{4\\pi \\varepsilon_0 a}$.\nTotal potential $V = V_1 + V_2 = 0$.",
    source: "JEE Main 2022",
  },
  {
    _id: "q-jee-12-2",
    questionNumber: 2,
    examCategory: "JEE/NEET",
    standard: "12th",
    subject: "Mathematics",
    chapter: "Integrals",
    topic: "Definite Integration Properties",
    difficulty: "Mid",
    questionText: "Evaluate the integral: $\\int_{0}^{\\pi/2} \\frac{\\sin x}{\\sin x + \\cos x} \\, dx$.",
    optionA: "$\\pi$",
    optionB: "$\\pi/2$",
    optionC: "$\\pi/4$",
    optionD: "$0$",
    correctAnswer: "C",
    explanation: "Let $I = \\int_{0}^{\\pi/2} \\frac{\\sin x}{\\sin x + \\cos x} dx$.\nUsing property $\\int_0^a f(x)dx = \\int_0^a f(a-x)dx$:\n$I = \\int_{0}^{\\pi/2} \\frac{\\cos x}{\\cos x + \\sin x} dx$.\nAdding both integrals: $2I = \\int_{0}^{\\pi/2} 1 \\, dx = \\pi/2 \\implies I = \\pi/4$.",
    source: "JEE Main 2019",
  },
  {
    _id: "q-jee-12-3",
    questionNumber: 3,
    examCategory: "JEE/NEET",
    standard: "12th",
    subject: "Biology",
    chapter: "Genetics",
    topic: "Mendelian Inheritance & Dihybrid Cross",
    difficulty: "Mid",
    questionText: "In a dihybrid cross between two heterozygous parents ($AaBb \\times AaBb$), what is the expected phenotypic ratio?",
    optionA: "$1:2:1$",
    optionB: "$3:1$",
    optionC: "$9:3:3:1$",
    optionD: "$9:7$",
    correctAnswer: "C",
    explanation: "The classical Mendelian dihybrid cross ratio for two independently assorting genes with complete dominance is 9 (dominant for both) : 3 (dominant 1st, recessive 2nd) : 3 (recessive 1st, dominant 2nd) : 1 (recessive for both).",
    source: "NEET 2023",
  },
];

export const MOCK_PAPERS: Paper[] = [
  {
    _id: "p-found-10-real-math",
    title: "Class 10 Foundation Mathematics - Real Numbers Special",
    examCategory: "Foundation",
    standard: "10th",
    examType: "FOUNDATION",
    year: 2026,
    subjects: ["Mathematics"],
    chapter: "Real Numbers",
    topic: "Euclid's Division & HCF",
    difficulty: "Mid",
    totalQuestions: 15,
    uploadedDate: "2026-09-27T10:00:00Z",
    subjectBreakdown: [{ subject: "Mathematics", count: 15 }],
  },
  {
    _id: "p-found-9-physics",
    title: "Class 9 Foundation Physics - Kinematics & Motion Test",
    examCategory: "Foundation",
    standard: "9th",
    examType: "FOUNDATION",
    year: 2026,
    subjects: ["Science", "Physics"],
    chapter: "Motion",
    topic: "Distance and Displacement",
    difficulty: "Easy",
    totalQuestions: 20,
    uploadedDate: "2026-09-26T14:30:00Z",
    subjectBreakdown: [{ subject: "Science", count: 20 }],
  },
  {
    _id: "p-jee-11-kinematics",
    title: "JEE Main Class 11 Physics - Kinematics & Vectors",
    examCategory: "JEE/NEET",
    standard: "11th",
    examType: "JEE",
    year: 2025,
    subjects: ["Physics"],
    chapter: "Kinematics",
    topic: "Relative Motion & Projectiles",
    difficulty: "Mid",
    totalQuestions: 25,
    uploadedDate: "2026-09-25T09:15:00Z",
    subjectBreakdown: [{ subject: "Physics", count: 25 }],
  },
  {
    _id: "p-jee-12-electrostatics",
    title: "JEE Advanced Class 12 Electrostatics & Current Electricity",
    examCategory: "JEE/NEET",
    standard: "12th",
    examType: "JEE",
    year: 2025,
    subjects: ["Physics", "Mathematics"],
    chapter: "Electrostatics",
    topic: "Electric Field & Gauss Law",
    difficulty: "Hard",
    totalQuestions: 30,
    uploadedDate: "2026-09-24T16:45:00Z",
    subjectBreakdown: [
      { subject: "Physics", count: 20 },
      { subject: "Mathematics", count: 10 },
    ],
  },
];

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/filters`, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fallback to static offline filter structure
  }

  return {
    examCategories: ["Foundation", "JEE/NEET"],
    standards: [
      { category: "Foundation", values: ["9th", "10th"] },
      { category: "JEE/NEET", values: ["11th", "12th"] },
    ],
    subjects: ["Physics", "Chemistry", "Mathematics", "Biology", "Science"],
    chapters: [
      "Motion",
      "Real Numbers",
      "Force and Laws of Motion",
      "Electricity",
      "Acids, Bases and Salts",
      "Kinematics",
      "Trigonometry",
      "Chemical Bonding",
      "Electrostatics",
      "Integrals",
      "Genetics",
    ],
    topics: [
      "Distance and Displacement",
      "Irrational Numbers & Identities",
      "Newton's Second Law",
      "Euclid's Division & HCF",
      "Ohm's Law & Resistance",
      "pH Scale & Neutralization",
      "Relative Motion & Projectiles",
      "Trigonometric Ratios & Identities",
      "VSEPR Theory & Hybridization",
      "Electric Field & Gauss Law",
      "Definite Integration Properties",
      "Mendelian Inheritance & Dihybrid Cross",
    ],
    levels: ["Easy", "Mid", "Hard"],
  };
}

export async function fetchQuestions(filters: FilterState): Promise<Question[]> {
  try {
    const query = new URLSearchParams();
    if (filters.examCategory !== "All") query.set("examCategory", filters.examCategory);
    if (filters.standard !== "All") query.set("standard", filters.standard);
    if (filters.subject !== "All") query.set("subject", filters.subject);
    if (filters.chapter !== "All" && filters.chapter) query.set("chapter", filters.chapter);
    if (filters.topic !== "All" && filters.topic) query.set("topic", filters.topic);
    if (filters.level !== "All") query.set("level", filters.level);

    const res = await fetchWithTimeout(`${API_BASE_URL}/questions?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.questions;
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((raw: any, idx: number): Question => {
          const diffMap: Record<string, "Easy" | "Mid" | "Hard"> = {
            Easy: "Easy",
            Medium: "Mid",
            Mid: "Mid",
            Hard: "Hard",
          };
          const difficulty = diffMap[raw.difficulty] || "Mid";
          return {
            _id: raw._id || `q-api-${idx}`,
            paperId: raw.paperId || "",
            questionNumber: raw.questionNumber ?? idx + 1,
            examCategory: raw.examCategory || "JEE/NEET",
            standard: raw.standard || "12th",
            subject: raw.subject || "Physics",
            chapter: raw.chapter || "",
            topic: raw.topic || "",
            difficulty,
            questionText: raw.questionText || "",
            optionA: raw.optionA || "",
            optionB: raw.optionB || "",
            optionC: raw.optionC || "",
            optionD: raw.optionD || "",
            correctAnswer: raw.correctAnswer || "A",
            explanation: raw.explanation || "",
            source: raw.source || "",
          };
        });
      }
    }
  } catch {
    // Fallback to local mock dataset
  }

  // Filter local mock data
  return MOCK_QUESTIONS.filter((q) => {
    if (filters.examCategory !== "All" && q.examCategory !== filters.examCategory) return false;
    if (filters.standard !== "All" && q.standard !== filters.standard) return false;
    if (filters.subject !== "All" && q.subject !== filters.subject) return false;
    if (filters.chapter !== "All" && filters.chapter && !q.chapter.toLowerCase().includes(filters.chapter.toLowerCase())) {
      return false;
    }
    if (filters.topic !== "All" && filters.topic && !q.topic.toLowerCase().includes(filters.topic.toLowerCase())) {
      return false;
    }
    if (filters.level !== "All" && q.difficulty !== filters.level) return false;
    if (filters.searchQuery) {
      const sq = filters.searchQuery.toLowerCase();
      const match =
        q.questionText.toLowerCase().includes(sq) ||
        q.chapter.toLowerCase().includes(sq) ||
        q.topic.toLowerCase().includes(sq) ||
        q.explanation.toLowerCase().includes(sq);
      if (!match) return false;
    }
    return true;
  });
}

export async function fetchPapers(filters: FilterState): Promise<Paper[]> {
  try {
    const query = new URLSearchParams();
    if (filters.examCategory !== "All") query.set("examCategory", filters.examCategory);
    if (filters.standard !== "All") query.set("standard", filters.standard);
    if (filters.subject !== "All") query.set("subject", filters.subject);
    if (filters.chapter !== "All" && filters.chapter) query.set("chapter", filters.chapter);
    if (filters.topic !== "All" && filters.topic) query.set("topic", filters.topic);
    if (filters.level !== "All") query.set("level", filters.level);

    const res = await fetchWithTimeout(`${API_BASE_URL}/papers?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback
  }

  return MOCK_PAPERS.filter((p) => {
    if (filters.examCategory !== "All" && p.examCategory !== filters.examCategory) return false;
    if (filters.standard !== "All" && p.standard !== filters.standard) return false;
    if (filters.subject !== "All" && !p.subjects.includes(filters.subject as any)) return false;
    if (filters.chapter !== "All" && filters.chapter && p.chapter && !p.chapter.toLowerCase().includes(filters.chapter.toLowerCase())) {
      return false;
    }
    if (filters.topic !== "All" && filters.topic && p.topic && !p.topic.toLowerCase().includes(filters.topic.toLowerCase())) {
      return false;
    }
    if (filters.level !== "All" && p.difficulty && p.difficulty !== filters.level) return false;
    if (filters.searchQuery) {
      const sq = filters.searchQuery.toLowerCase();
      const match = p.title.toLowerCase().includes(sq) || (p.chapter && p.chapter.toLowerCase().includes(sq));
      if (!match) return false;
    }
    return true;
  });
}
