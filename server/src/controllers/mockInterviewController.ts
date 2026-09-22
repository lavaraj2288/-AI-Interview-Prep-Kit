import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { defaultLLMClient } from '../services/llm/llmClient.js';

export async function evaluateMockAnswer(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { questionPrompt, answerOutline, candidateAnswer, category } = req.body;

    if (!questionPrompt || !candidateAnswer) {
      res.status(400).json({ error: 'questionPrompt and candidateAnswer are required.' });
      return;
    }

    const systemPrompt = `You are a strict, senior engineering interviewer evaluating a candidate's mock interview response.
Provide an objective, actionable evaluation comparing their answer against the benchmark outline.

RUBRIC:
1. Technical / Domain Accuracy (0-100): Did they demonstrate deep understanding and avoid factual errors?
2. Communication & Structure (0-100): Was the answer structured (e.g. STAR method for behavioural, clear trade-offs for technical/system design)?
3. Strengths: Bullet points of what they did well.
4. Areas for Improvement: Concrete ways to make the answer stronger.
5. Overall Score: (0-100)
6. Follow-up Probe: One sharp follow-up question an interviewer would ask next.

Return valid JSON only.
OUTPUT FORMAT:
{
  "overallScore": 85,
  "accuracyScore": 88,
  "communicationScore": 82,
  "strengths": ["string"],
  "improvements": ["string"],
  "feedback": "string",
  "followUpQuestion": "string"
}`;

    const userPrompt = `QUESTION:
${questionPrompt}

CATEGORY:
${category || 'technical'}

BENCHMARK ANSWER OUTLINE:
${answerOutline || 'Demonstrate thorough problem solving, clear communication, and relevant experience.'}

CANDIDATE ANSWER:
${candidateAnswer}`;

    const evaluation = await defaultLLMClient.generateJson<{
      overallScore: number;
      accuracyScore: number;
      communicationScore: number;
      strengths: string[];
      improvements: string[];
      feedback: string;
      followUpQuestion: string;
    }>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });

    res.status(200).json({ evaluation });
  } catch (err) {
    console.error('Mock interview evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate mock interview answer.' });
  }
}
