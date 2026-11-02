# Plan quality eval

Question: is our plan better than what a beginner gets free from a chatbot, measured against the goal of a first paying customer?

Nothing real has run yet. It needs an Anthropic API key. Run it from the project folder:

```bash
node evals/plan-quality/run.mjs
```

`--dry` checks the pipeline with no API calls. Results go to `results/`: `summary.json`, `scores.csv`, `raw.json`, `pairs-for-honza.md` and `pairs-key.json`, which stays closed until Honza has given his verdicts.

Limits of this test:
- Plan B comes from Claude Opus 5.5 as a stand-in for a free chatbot, not from ChatGPT itself. It is a strong opponent, but not the same product.
- The grader is also a Claude model, so Honza's 5 pairs are the check on it.
- A runs on Haiku 4.5 as on the live site and B on Opus 5.5, so a loss alone does not separate a weak model from a weak prompt.
- Plan A is the free-stage plan from `api/generate.js`. The paid blocks and live competitor search are not part of this comparison.
- The headings requested from B come from our plan structure, so B gets guidance a typical free user would not write. Together with Opus this pushes against A. The pass bar stays the same, and the result report must state this.
- Location, lifestyle, business type and timeline are fixed for every profile, and interests repeat strengths, because the table below does not set them.

## Method

For each profile, generate two plans:
- **A:** our current prompts from `api/generate.js`.
- **B:** a good free prompt: "Here are my answers. Recommend one business and give me a plan to get my first paying customer." It also asks for the same plain headings as plan A, so format does not reveal the author.

The grader sees the plans in random order, without labels. Honza reads at least 5 pairs himself, and where he disagrees with the grader, his verdict counts.

## Profiles (synthetic, not real users)

| # | Age | Time/week | Budget | Strengths | People ask them for | Holding them back |
|---|---|---|---|---|---|---|
| 1 | 18–24 | 5–10h | €0 | Video, social | Editing clips | Finding clients |
| 2 | 25–34 | 5–10h | under €100 | Writing | Fixing CVs | Confidence |
| 3 | 25–34 | under 5h | €0 | Numbers | Excel help | Time |
| 4 | 35–44 | 5–10h | under €500 | Sales | Negotiating car deals | Where to start |
| 5 | 35–44 | under 5h | €0 | Organising | Planning family events | Time |
| 6 | 45–54 | 10–20h | under €1,000 | Teaching | Explaining maths | Finding clients |
| 7 | 45–54 | 5–10h | under €500 | Hands-on repairs | Fixing bikes | Confidence |
| 8 | 55+ | 10–20h | under €1,000 | 30 years in accounting | Tax questions | Where to start |
| 9 | 55+ | 5–10h | €0 | Gardening | Plant advice | Technology |
| 10 | 25–34 | 20–40 h | under €1,000 | Coding | Fixing websites | Finding clients |
| 11 | 18–24 | 10–20h | €0 | Languages | Translating | Where to start |
| 12 | 35–44 | 5–10h | under €100 | Cooking | Meal planning | Confidence |
| 13 | 25–34 | under 5h | under €100 | Design | Logos and flyers | Time |
| 14 | 45–54 | 5–10h | under €500 | Care work | Advice on caring for parents | Where to start |
| 15 | 25–34 | 5–10h | €0 | Nothing specific | Not answered | Confidence |

## Grading (each 0 to 2)

1. **Personal:** would the plan change if the answers changed?
2. **Realistic:** can this person do it with their time and budget?
3. **First customer:** does it say who to contact, where to find them and what to offer this week?
4. **Honest:** no invented statistics, companies or claimed past results.
5. **Ready to use:** could the messages be sent with only names filled in?

## Pass bar

- A wins at least 12 of 15 pairs.
- A never scores 0 on Honest.
- Across the 15 profiles, at least 10 different kinds of business are recommended.

Before results are trusted, grade 3 pairs twice to check the grader agrees with itself, and compare it with Honza's verdicts.
