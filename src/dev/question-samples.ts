// Question content that has broken the renderer before, for the dev-only preview
// screen (src/app/dev/question-preview.tsx) and the regression tests
// (tests/question-rendering.test.mjs). Real bank questions, copied as stored,
// except the two option-shape samples at the end. Not shipped in release builds:
// only reached through a `__DEV__`-guarded require.

export interface SampleQuestion {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerType: string;
  diagramUrls?: string[];
  optionDiagramUrls?: { A: string[]; B: string[]; C: string[]; D: string[] };
  correctAnswer?: string;
}

const noFigures = { A: [], B: [], C: [], D: [] };

export const SAMPLES: { id: string; title: string; source: string; question: SampleQuestion }[] = [
  {
    id: 'match-the-column',
    title: 'Match the column (Q17, Units and Measurements)',
    source: 'bank 6ada85591aa9e8d314ab55ea · IIT 2007',
    question: {
      questionText:
        'Some physical quantities are given in Column \\(I\\) and some possible \\(SI\\) units in which these quantities may be expressed are given in Column \\(II\\). Match the physical quantities in Column \\(I\\) with the units in Column \\(II\\).\n\\[\\def\\arraystretch{1.5}\\begin{array}{|l|l|}\\hline \\text{Column }{I} & \\text{Column }{II} \\\\ \\hline {(A)}\\text{ }{GM_e M_s}\\text{ (}{G}\\text{: universal gravitational constant, }{M_e}\\text{: mass of the earth, }{M_s}\\text{: mass of the Sun)} & {(p)}\\text{ }{(\\text{volt})(\\text{coulomb})(\\text{metre})} \\\\ \\hline {(B)}\\text{ }{\\frac{3RT}{M}}\\text{ (}{R}\\text{: universal gas constant, }{T}\\text{: absolute temperature, }{M}\\text{: molar mass)} & {(q)}\\text{ }{(\\text{kg})(\\text{m})^3(\\text{s})^{-2}} \\\\ \\hline {(C)}\\text{ }{\\frac{F^2}{q^2 B^2}}\\text{ (}{F}\\text{: force, }{q}\\text{: charge, }{B}\\text{: magnetic field)} & {(r)}\\text{ }{(\\text{m})^2(\\text{s})^{-2}} \\\\ \\hline {(D)}\\text{ }{\\frac{GM_e}{R_e}}\\text{ (}{G}\\text{: universal gravitational constant, }{M_e}\\text{: mass of the earth, }{R_e}\\text{: radius of the earth)} & {(s)}\\text{ }{(\\text{farad})(\\text{volt})^2(\\text{kg})^{-1}} \\\\ \\hline \\end{array}\\]',
      optionA: '\\(A \\rightarrow (q), B \\rightarrow (r), C \\rightarrow (r), D \\rightarrow (r)\\)',
      optionB: '\\(A \\rightarrow (p), B \\rightarrow (r), C \\rightarrow (r), D \\rightarrow (r)\\)',
      optionC: '\\(A \\rightarrow (q), B \\rightarrow (r), C \\rightarrow (s), D \\rightarrow (r)\\)',
      optionD: '\\(A \\rightarrow (p), B \\rightarrow (s), C \\rightarrow (q), D \\rightarrow (r)\\)',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
      correctAnswer: 'A',
    },
  },
  {
    id: 'table',
    title: 'Table (frequency distribution)',
    source: 'bank 6ae10b43b4468956be7d64d0 · JEE MAIN 2020',
    question: {
      questionText:
        'If the variance of the following frequency distribution is \\(50\\), then \\(x\\) is equal to:\n\\[\\def\\arraystretch{1.5}\\begin{array}{|l|l|}\\hline \\text{Class} & {10-20, 20-30, 30-40} \\\\ \\hline \\text{Frequency} & {2, x, 2} \\\\ \\hline \\end{array}\\]',
      optionA: '\\(4\\)',
      optionB: '\\(-2\\)',
      optionC: '\\(-4\\)',
      optionD: '\\(2\\)',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
      correctAnswer: 'A',
    },
  },
  {
    id: 'long-equation-inline',
    title: 'Long equation (inline cases)',
    source: 'bank 6ae10b13b4468956be7d5e08 · JEE MAIN 2019',
    question: {
      questionText:
        'If the function \\(f\\) defined on \\(\\left( \\frac{\\pi }{6}, \\frac{\\pi }{3} \\right)\\) by \\(f(x) = \\begin{cases} \\frac{\\sqrt{2} \\cos x - 1}{\\cot x - 1}, & x \\neq \\frac{\\pi}{4} \\\\ k, & x = \\frac{\\pi}{4} \\end{cases}\\) is continuous, then \\(k\\) is equal to',
      optionA: '\\(1\\)',
      optionB: '\\(2\\)',
      optionC: '\\(\\frac{1}{2}\\)',
      optionD: '\\(\\frac{1}{\\sqrt{2}}\\)',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
      correctAnswer: 'C',
    },
  },
  {
    id: 'long-equation-display',
    title: 'Long equation (display, one unbreakable piece)',
    source: 'made up from bank-style notation',
    question: {
      questionText:
        'Evaluate\n\\[\\lim_{x \\to 0} \\frac{\\left(1+\\sin x\\right)^{\\frac{1}{x}} - e \\left(1 - \\frac{x}{2} + \\frac{11 x^{2}}{24}\\right) + \\left(\\cos x\\right)^{\\frac{1}{x^{2}}} - e^{-\\frac{1}{2}}}{x^{3} \\left(1 + \\tan^{2} x + \\sec^{2} x + \\log\\left(1+x^{2}\\right)\\right)}\\]',
      optionA: '\\(\\frac{e}{16}\\)',
      optionB: '\\(\\frac{-e}{16}\\)',
      optionC: '\\(0\\)',
      optionD: 'does not exist',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
    },
  },
  {
    id: 'image',
    title: 'Image (figure in the question)',
    source: 'bank 6ada99b81aa9e8d314ad1a91 · AIPMT 2013',
    question: {
      questionText: '\\(A, B\\) and \\(C\\) are three points in a uniform electric field as shown in the figure. The electric potential is',
      optionA: 'maximum at \\(A\\)',
      optionB: 'maximum at \\(B\\)',
      optionC: 'maximum at \\(C\\)',
      optionD: 'the same at all three points \\(A, B\\) and \\(C\\)',
      answerType: 'MCQ',
      diagramUrls: ['https://vedclass-cdn.s3.ap-south-1.amazonaws.com/uploads/question_images/115-723.jpg'],
      optionDiagramUrls: noFigures,
      correctAnswer: 'B',
    },
  },
  {
    id: 'math-options',
    title: 'Four options with maths',
    source: 'bank 6adb1c515225f0ad50c23bb7 · MHT CET 2012',
    question: {
      questionText: 'The value of \\(\\int \\frac{x^{2}+1}{x^{4}+x^{2}+1} dx\\) is',
      optionA: '\\(\\frac{1}{\\sqrt{3}} \\tan ^{-1}\\left\\{\\frac{x-1/x}{\\sqrt{3}}\\right\\}+C\\)',
      optionB: '\\(\\frac{1}{2 \\sqrt{3}} \\log \\left\\{\\frac{(x-1/x)-\\sqrt{3}}{(x-1/x)+\\sqrt{3}}\\right\\}+C\\)',
      optionC: '\\(\\tan ^{-1}\\left(\\frac{x+1/x}{\\sqrt{3}}\\right)+C\\)',
      optionD: '\\(\\tan ^{-1}\\left(\\frac{x-1/x}{\\sqrt{3}}\\right)+C\\)',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
      correctAnswer: 'A',
    },
  },
  {
    id: 'true-false',
    title: 'True / False (two options, nothing missing)',
    source: 'shape of bank 6ada7bd987617a4e668a2f8d',
    question: {
      questionText: 'State whether the following statement is true or false:\nEvery whole number is a natural number.',
      optionA: 'True',
      optionB: 'False',
      optionC: '',
      optionD: '',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
    },
  },
  {
    id: 'missing-option',
    title: 'A gap in the options (B empty)',
    source: 'made up: the shape of 2 bank questions',
    question: {
      questionText: 'Which of these is a unit of energy?',
      optionA: 'newton',
      optionB: '',
      optionC: 'joule',
      optionD: 'pascal',
      answerType: 'MCQ',
      diagramUrls: [],
      optionDiagramUrls: noFigures,
    },
  },
];
