import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Kit } from '../models/Kit.js';
import { PrepKit, KitQuestion, QuestionCategory } from '../types/kit.js';
import { runPrepKitPipeline } from '../services/pipeline/orchestrator.js';
import { validatePrepKit } from '../services/pipeline/kitValidator.js';
import { checkCoverage } from '../services/pipeline/coverageChecker.js';
import { allocateSchedule } from '../services/pipeline/scheduleAllocator.js';
import { defaultLLMClient } from '../services/llm/llmClient.js';
import { buildCategoryQuestionsPrompt, buildCompanyBriefPrompt } from '../services/llm/prompts.js';
import { FallbackStore } from '../services/storage/fallbackStore.js';

export async function createKit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { jd, company_url, days } = req.body;

    if (!jd || !company_url) {
      res.status(400).json({ error: 'Job description and company website URL are required.' });
      return;
    }

    const safeDays = Math.max(1, Math.min(60, parseInt(days, 10) || 5));

    const pipelineResult = await runPrepKitPipeline({
      jd,
      companyUrl: company_url,
      days: safeDays,
    });

    if (!pipelineResult.success || !pipelineResult.kit) {
      res.status(422).json({
        error: pipelineResult.error?.message || 'Failed to generate interview prep kit.',
        code: pipelineResult.error?.code || 'GENERATION_FAILED',
      });
      return;
    }

    if (!FallbackStore.isMongoConnected()) {
      const fakeId = `mem_kit_${Date.now()}`;
      const memDoc = {
        _id: fakeId,
        userId: req.userId || 'anon',
        title: `${pipelineResult.kit.role.title} at ${pipelineResult.kit.source.company}`,
        company: pipelineResult.kit.source.company,
        kit: pipelineResult.kit,
        status: 'ready' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      FallbackStore.kits.set(fakeId, memDoc);
      res.status(201).json({
        message: 'Interview Prep Kit generated successfully (in-memory mode)',
        kitId: fakeId,
        kit: pipelineResult.kit,
      });
      return;
    }

    const newKitDoc = await Kit.create({
      userId: req.userId,
      title: `${pipelineResult.kit.role.title} at ${pipelineResult.kit.source.company}`,
      company: pipelineResult.kit.source.company,
      kit: pipelineResult.kit,
      status: 'ready',
    });

    res.status(201).json({
      message: 'Interview Prep Kit generated successfully',
      kitId: newKitDoc._id,
      kit: pipelineResult.kit,
    });
  } catch (err) {
    console.error('Create kit error:', err);
    res.status(500).json({ error: 'Internal server error while creating kit.' });
  }
}

export async function getUserKits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!FallbackStore.isMongoConnected()) {
      const userKits = Array.from(FallbackStore.kits.values())
        .filter((k) => k.userId === req.userId)
        .map((k) => ({
          _id: k._id,
          title: k.title,
          company: k.company,
          kit: {
            coverage: k.kit.coverage,
            schedule: { days_available: k.kit.schedule.days_available },
          },
          createdAt: k.createdAt,
          updatedAt: k.updatedAt,
        }));
      res.status(200).json({ kits: userKits });
      return;
    }

    const kits = await Kit.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select('_id title company kit.coverage kit.schedule.days_available createdAt updatedAt');

    res.status(200).json({ kits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve kits.' });
  }
}

export async function getKitById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!FallbackStore.isMongoConnected()) {
      const memDoc = FallbackStore.kits.get(String(req.params.id));
      if (!memDoc || memDoc.userId !== req.userId) {
        res.status(404).json({ error: 'Kit not found or access denied.' });
        return;
      }
      res.status(200).json({
        id: memDoc._id,
        title: memDoc.title,
        company: memDoc.company,
        kit: memDoc.kit,
        createdAt: memDoc.createdAt,
        updatedAt: memDoc.updatedAt,
      });
      return;
    }

    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc) {
      res.status(404).json({ error: 'Kit not found or access denied.' });
      return;
    }

    res.status(200).json({
      id: kitDoc._id,
      title: kitDoc.title,
      company: kitDoc.company,
      kit: kitDoc.kit,
      createdAt: kitDoc.createdAt,
      updatedAt: kitDoc.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve kit.' });
  }
}

export async function updateKit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { kit } = req.body;
    if (!kit) {
      res.status(400).json({ error: 'Updated kit payload is required.' });
      return;
    }

    // Validate structure
    const validation = validatePrepKit(kit);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid kit structure',
        details: validation.errors,
      });
      return;
    }

    if (!FallbackStore.isMongoConnected()) {
      const memDoc = FallbackStore.kits.get(String(req.params.id));
      if (!memDoc || memDoc.userId !== req.userId) {
        res.status(404).json({ error: 'Kit not found or access denied.' });
        return;
      }
      memDoc.kit = kit;
      memDoc.title = `${kit.role.title} at ${kit.source.company}`;
      memDoc.company = kit.source.company;
      memDoc.updatedAt = new Date();
      res.status(200).json({ message: 'Kit updated successfully', kit: memDoc.kit });
      return;
    }

    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc) {
      res.status(404).json({ error: 'Kit not found or access denied.' });
      return;
    }

    kitDoc.kit = kit;
    kitDoc.title = `${kit.role.title} at ${kit.source.company}`;
    kitDoc.company = kit.source.company;
    await kitDoc.save();

    res.status(200).json({
      message: 'Kit updated successfully',
      kit: kitDoc.kit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update kit.' });
  }
}

export async function deleteKit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!FallbackStore.isMongoConnected()) {
      const memDoc = FallbackStore.kits.get(String(req.params.id));
      if (!memDoc || memDoc.userId !== req.userId) {
        res.status(404).json({ error: 'Kit not found.' });
        return;
      }
      FallbackStore.kits.delete(String(req.params.id));
      res.status(200).json({ message: 'Kit deleted successfully.' });
      return;
    }

    const deleted = await Kit.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) {
      res.status(404).json({ error: 'Kit not found.' });
      return;
    }

    res.status(200).json({ message: 'Kit deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete kit.' });
  }
}

/**
 * Regenerates a single section without losing edits made elsewhere.
 * Preserves questions that are manual, edited, or pinned!
 */
export async function regenerateSection(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { section, category } = req.body; // e.g. section: 'question-category' | 'company_brief' | 'schedule'
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });

    if (!kitDoc) {
      res.status(404).json({ error: 'Kit not found.' });
      return;
    }

    const kit: PrepKit = kitDoc.kit;

    if (section === 'company_brief') {
      const briefPrompts = buildCompanyBriefPrompt(
        kit.source.company,
        [{ url: kit.source.company_url, title: 'Company Page', content: kit.company_brief.what_they_do, category: 'company' }],
        'Regenerated corporate research.'
      );

      const regenerated = await defaultLLMClient.generateJson<{ summary: string; what_they_do: string }>({
        systemPrompt: briefPrompts.systemPrompt,
        userPrompt: briefPrompts.userPrompt,
      });

      kit.company_brief.summary = regenerated.summary || kit.company_brief.summary;
      kit.company_brief.what_they_do = regenerated.what_they_do || kit.company_brief.what_they_do;
    } else if (section === 'schedule') {
      // Re-allocate schedule deterministically with current active questions
      kit.schedule = allocateSchedule(
        kit.role.requirements,
        kit.questions,
        kit.schedule.days_available
      );
    } else if (section === 'question_category' && category) {
      const targetCategory = category as QuestionCategory;

      // PRESERVATION LOGIC:
      // Questions to preserve: origin === 'manual' || origin === 'edited' || pinned === true
      const preservedQuestions = kit.questions.filter((q) => {
        if (q.category !== targetCategory) return true; // keep other categories untouched
        return q.origin === 'manual' || q.origin === 'edited' || q.pinned === true;
      });

      // Find requirements relevant to this category
      const targetReqs = kit.role.requirements.filter((r) =>
        targetCategory === 'technical'
          ? r.kind === 'technical' || r.kind === 'domain'
          : targetCategory === 'behavioural'
          ? r.kind === 'behavioural'
          : true
      );

      const prompts = buildCategoryQuestionsPrompt(
        targetCategory,
        targetReqs.length > 0 ? targetReqs : kit.role.requirements.slice(0, 2),
        kit.company_brief,
        '',
        kit.questions.length + 10
      );

      const freshResult = await defaultLLMClient.generateJson<{
        questions: KitQuestion[];
        flashcards: unknown[];
      }>({
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
      });

      const newGeneratedQuestions: KitQuestion[] = [];
      if (Array.isArray(freshResult.questions)) {
        for (let i = 0; i < freshResult.questions.length; i++) {
          const fresh = freshResult.questions[i];
          newGeneratedQuestions.push({
            id: `q_regen_${Date.now()}_${i + 1}`,
            requirement_ids: fresh.requirement_ids || [kit.role.requirements[0]?.id || 'r1'],
            category: targetCategory,
            prompt: fresh.prompt,
            answer_outline: fresh.answer_outline,
            difficulty: Math.max(1, Math.min(3, fresh.difficulty || 2)),
            origin: 'generated',
            pinned: false,
          });
        }
      }

      // Merge preserved questions and new questions
      kit.questions = [...preservedQuestions, ...newGeneratedQuestions];

      // Re-evaluate coverage
      const coverageAnalysis = checkCoverage(kit.role.requirements, kit.questions, kit.coverage.passes);
      kit.coverage = coverageAnalysis.coverage;

      // Re-allocate schedule
      kit.schedule = allocateSchedule(
        kit.role.requirements,
        kit.questions,
        kit.schedule.days_available
      );
    }

    kitDoc.kit = kit;
    kitDoc.markModified('kit');
    await kitDoc.save();

    res.status(200).json({
      message: `Section "${section}" regenerated successfully while preserving user edits.`,
      kit: kitDoc.kit,
    });
  } catch (err) {
    console.error('Regenerate section error:', err);
    res.status(500).json({ error: 'Failed to regenerate section.' });
  }
}

export async function batchUpload(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      res.status(400).json({ error: 'Cases array is required.' });
      return;
    }

    const createdKits = [];
    const errors = [];

    for (const c of cases) {
      try {
        const result = await runPrepKitPipeline({
          jd: c.jd,
          companyUrl: c.company_url,
          days: c.days || 5,
        });

        if (result.success && result.kit) {
          const doc = await Kit.create({
            userId: req.userId,
            title: `${result.kit.role.title} at ${result.kit.source.company}`,
            company: result.kit.source.company,
            kit: result.kit,
            status: 'ready',
          });
          createdKits.push({ id: doc._id, title: doc.title });
        } else {
          errors.push({ company_url: c.company_url, error: result.error });
        }
      } catch (e) {
        errors.push({ company_url: c.company_url, error: String(e) });
      }
    }

    res.status(200).json({
      message: `Batch processed: ${createdKits.length} succeeded, ${errors.length} failed.`,
      createdKits,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: 'Batch processing error.' });
  }
}
