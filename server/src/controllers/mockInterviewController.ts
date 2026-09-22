import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { fallbackStore } from '../services/storage/fallbackStore.js';
import { defaultLlmClient } from '../services/llm/llmClient.js';

export async function evaluateMockAnswer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { kitId, questionId, userAnswer } = req.body;

    if (!kitId || !questionId || !userAnswer) {
      res.status(400).json({ error: 'kitId, questionId, and userAnswer are required' });
      return;
    }

    const kitRecord = fallbackStore.findKitById(kitId);
    if (!kitRecord) {
      res.status(404).json({ error: 'Kit not found' });
      return;
    }

    const question = kitRecord.kit.questions.find(q => q.id === questionId);
    if (!question) {
      res.status(404).json({ error: 'Question not found in kit' });
      return;
    }

    const prompt = `
You are an expert technical hiring manager evaluating an interview candidate's spoken or typed answer.

Role: ${kitRecord.kit.role.title}
Target Company: ${kitRecord.kit.source.company}
Question: "${question.prompt}"
Category: ${question.category}
Expected Answer Outline: "${question.answer_outline}"

Candidate's Answer:
"""
${userAnswer}
"""

Evaluate the candidate's answer constructively and return ONLY a JSON object with this exact shape:
{
  "score": 85, // integer 0 to 100
  "rating": "Strong | Adequate | Needs Work",
  "strengths": ["Clear communication of X", "Good architectural justification"],
  "areas_for_improvement": ["Did not mention scalability bottlenecks", "Could provide a clearer STAR metric"],
  "model_response_tip": "A concise example sentence of how to elevate this answer."
}
`;

    const fallbackEvaluation = () => {
      const wordCount = userAnswer.trim().split(/\s+/).length;
      const score = Math.min(95, Math.max(50, wordCount * 2));
      return {
        score,
        rating: score >= 80 ? 'Strong' : score >= 65 ? 'Adequate' : 'Needs Work',
        strengths: [
          'Directly addresses the prompt topic',
          'Demonstrates understanding of core trade-offs'
        ],
        areas_for_improvement: [
          'Expand on quantifiable outcomes or metrics',
          'Elaborate on edge-case failure modes'
        ],
        model_response_tip: `Emphasize why you chose your specific technical approach over alternatives when discussing ${question.category}.`
      };
    };

    const evaluation = await defaultLlmClient.generateJson(prompt, fallbackEvaluation);

    res.json({
      questionId,
      prompt: question.prompt,
      evaluation
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to evaluate mock answer', details: err.message });
  }
}
