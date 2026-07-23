export interface PromptSuggestion {
  label: string;
  template: string;
}

export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    label: "Find the right person",
    template: "Find the best person for a [role/task] based on their skills and completed courses.",
  },
  {
    label: "Leadership talent",
    template: "Who has strong 360-degree Leadership feedback and has completed leadership-related LMS courses?",
  },
  {
    label: "Skill search",
    template: "List people skilled in [skill] who are part of [Umoor/Team].",
  },
  {
    label: "Compare candidates",
    template: "Compare the top candidates for a [Designation] role by badges, degrees, and feedback scores.",
  },
  {
    label: "Course completion",
    template: "Who has completed [course name] in the LMS?",
  },
  {
    label: "Well-rounded performers",
    template: "Who are the most well-rounded performers across Leadership, Teamwork, and Dedication feedback?",
  },
  {
    label: "Count / ratio",
    template: "How many people are skilled in [skill], and what's the male-to-female ratio among them?",
  },
  {
    label: "Breakdown by group",
    template: "Give me a breakdown of how many people belong to each [Umoor/Jamiat/Designation].",
  },
  {
    label: "Post eligibility",
    template: "Who is eligible to hold a critical post right now, and how many years do they have left before the 9-year cap?",
  },
  {
    label: "Tenure & term limits",
    template: "Show tenure details (years on post, managing, advisory) for [Name/Umoor], including years left before term limits.",
  },
];
