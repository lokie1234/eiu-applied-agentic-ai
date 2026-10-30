export const MIS301_COURSE_ID = "5e9700b6-d498-4ce7-b7b5-3cabca3fe8d5";
export const MIS301_SECTION_ID = "71c4d32e-7d80-4ae6-9576-13a0840ccd45";
// Server-owned report labels and allowed fields. Never accept identity or schema from a slide.
export const MIS301_PRACTICE = {
  import: { label: "Practice 1 · Import", fields: [{ id: "code", label: "Import code" }, { id: "readCode", label: "Read CSV code", optional: true }, { id: "storeCode", label: "Store DataFrame code", optional: true }] },
  explore: { label: "Practice 2 · Explore", fields: [{ id: "headCode", label: "First 10 rows code" }, { id: "tailCode", label: "Last 5 rows code" }, { id: "rows", label: "Rows" }, { id: "columns", label: "Columns" }, { id: "shapeCode", label: "Q1 answer code", optional: true }] },
  scores: { label: "Practice 3 · Happiness Score", fields: [{ id: "mean", label: "Average score" }, { id: "minimum", label: "Minimum score" }, { id: "code", label: "Evidence code" }] },
  quality: { label: "Practice 4 · Data quality", fields: [{ id: "countryType", label: "country_name dtype" }, { id: "supportCount", label: "social_support count" }, { id: "explanation", label: "Missing values explanation", optional: true }, { id: "typeCode", label: "Q4 answer code", optional: true }, { id: "countCode", label: "Q5 answer code", optional: true }] },
} as const;
export type Mis301Part = keyof typeof MIS301_PRACTICE;
export function mis301Part(value: unknown): Mis301Part | null {
  return typeof value === "string" && Object.hasOwn(MIS301_PRACTICE, value) ? value as Mis301Part : null;
}

export const MIS301_QUESTION_FIELDS = {
  "1": {
    "partId": "import",
    "fields": [
      "code",
      "readCode",
      "storeCode"
    ],
    "required": [
      "code",
      "readCode",
      "storeCode"
    ],
    "codeFields": [
      "code",
      "readCode",
      "storeCode"
    ],
    "answerFields": []
  },
  "2": {
    "partId": "explore",
    "fields": [
      "headCode",
      "tailCode"
    ],
    "required": [
      "headCode",
      "tailCode"
    ],
    "codeFields": [
      "headCode",
      "tailCode"
    ],
    "answerFields": []
  },
  "3": {
    "partId": "explore",
    "fields": [
      "shapeCode",
      "rows",
      "columns"
    ],
    "required": [
      "shapeCode",
      "rows",
      "columns"
    ],
    "codeFields": [
      "shapeCode"
    ],
    "answerFields": [
      {
        "id": "rows",
        "label": "Rows",
        "numeric": true
      },
      {
        "id": "columns",
        "label": "Columns",
        "numeric": true
      }
    ]
  },
  "4": {
    "partId": "scores",
    "fields": [
      "code",
      "mean"
    ],
    "required": [
      "code",
      "mean"
    ],
    "codeFields": [
      "code"
    ],
    "answerFields": [
      {
        "id": "mean",
        "label": "Average Happiness Score",
        "numeric": true
      }
    ]
  },
  "5": {
    "partId": "scores",
    "fields": [
      "code",
      "minimum"
    ],
    "required": [
      "code",
      "minimum"
    ],
    "codeFields": [
      "code"
    ],
    "answerFields": [
      {
        "id": "minimum",
        "label": "Minimum Happiness Score",
        "numeric": true
      }
    ]
  },
  "6": {
    "partId": "quality",
    "fields": [
      "typeCode",
      "countryType"
    ],
    "required": [
      "typeCode",
      "countryType"
    ],
    "codeFields": [
      "typeCode"
    ],
    "answerFields": [
      {
        "id": "countryType",
        "label": "country_name data type"
      }
    ]
  },
  "7": {
    "partId": "quality",
    "fields": [
      "countCode",
      "supportCount"
    ],
    "required": [
      "countCode",
      "supportCount"
    ],
    "codeFields": [
      "countCode"
    ],
    "answerFields": [
      {
        "id": "supportCount",
        "label": "social_support values",
        "numeric": true
      }
    ]
  }
} as const;
export function mis301Question(value: number) { return MIS301_QUESTION_FIELDS[String(value) as keyof typeof MIS301_QUESTION_FIELDS]; }

export const MIS301_QUESTION_DEFAULTS = [
  {
    "number": 1,
    "title": "1. Read in Data From CSV File",
    "prompt": "1. Read in Data From CSV File",
    "starterCode": "# Import Pandas\n\n\n# Read data file\n\n\n# Store data in a DataFrame\ndf=\ndf",
    "tasks": [
      {
        "label": "Import Pandas",
        "code": "# Import Pandas\n"
      },
      {
        "label": "Read data file",
        "code": "# Read data file\n"
      },
      {
        "label": "Store data in a DataFrame",
        "code": "# Store data in a DataFrame\ndf=\ndf"
      }
    ]
  },
  {
    "number": 2,
    "title": "2. Quickly Explore the DataFrame",
    "prompt": "2. Quickly Explore the DataFrame",
    "starterCode": "# Show the first 10 rows of the DataFrame\n\n\n# Show the last 5 rows of the DataFrame\n",
    "tasks": [
      {
        "label": "Show the first 10 rows of the DataFrame",
        "code": "# Show the first 10 rows of the DataFrame\n"
      },
      {
        "label": "Show the last 5 rows of the DataFrame",
        "code": "# Show the last 5 rows of the DataFrame\n"
      }
    ]
  },
  {
    "number": 3,
    "title": "Question 1",
    "prompt": "What is the total number of rows and columns in this DataFrame?",
    "starterCode": "# Your answer:\n\n",
    "tasks": [
      {
        "label": "Question 1 answer code",
        "code": "# Your answer:\n\n"
      }
    ]
  },
  {
    "number": 4,
    "title": "Question 2",
    "prompt": "What is the average Happiness Score?",
    "starterCode": "# Your answer:\n",
    "tasks": [
      {
        "label": "Question 2 answer code",
        "code": "# Your answer:\n"
      }
    ]
  },
  {
    "number": 5,
    "title": "Question 3",
    "prompt": "What is the minimum Happiness Score?",
    "starterCode": "# Your answer:\n",
    "tasks": [
      {
        "label": "Question 3 answer code",
        "code": "# Your answer:\n"
      }
    ]
  },
  {
    "number": 6,
    "title": "Question 4",
    "prompt": "Check the data types of column country_name?",
    "starterCode": "# Your answer:\n",
    "tasks": [
      {
        "label": "Question 4 answer code",
        "code": "# Your answer:\n"
      }
    ]
  },
  {
    "number": 7,
    "title": "Question 5",
    "prompt": "What is the total number of values in the social_support column?",
    "starterCode": "# Your answer:\n",
    "tasks": [
      {
        "label": "Question 5 answer code",
        "code": "# Your answer:\n"
      }
    ]
  }
] as const;
export type Mis301QuestionConfig = { number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> };
export function mis301QuestionBank(config?: readonly Mis301QuestionConfig[], preserveLegacy = false) {
  if (config?.length === 5 && !preserveLegacy) config = undefined;
  return MIS301_QUESTION_DEFAULTS.map(base => {
    const existing = config?.find(item => item.number === (config?.length === 5 ? base.number - 2 : base.number));
    if (!existing) return { ...base, tasks: base.tasks.map(task => ({ ...task })) };
    const tasks = config?.length === 5 ? [{ label: base.tasks[0].label, code: existing.starterCode }] : existing.tasks || base.tasks.map(task => ({ ...task }));
    return { ...base, ...existing, number: base.number, title: existing.title || base.title, tasks };
  });
}
