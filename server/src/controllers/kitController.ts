import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { KitPipelineOrchestrator } from '../services/pipeline/orchestrator.js';
import { fallbackStore, StoredKit } from '../services/storage/fallbackStore.js';
import { Kit } from '../models/Kit.js';
import { allocateSchedule } from '../services/pipeline/scheduleAllocator.js';
import { checkRequirementCoverage } from '../services/pipeline/coverageChecker.js';
import { AppendixAKit, KitQuestion } from '../types/kit.js';

const orchestrator = new KitPipelineOrchestrator();

const isDbConnected = () => mongoose.connection.readyState === 1;

export async function createKit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { jd, company_url, days, company_name } = req.body;

    if (!jd || typeof jd !== 'string' || jd.trim().length === 0) {
      res.status(400).json({ error: 'Job description (jd) is required' });
      return;
    }

    if (!company_url || typeof company_url !== 'string') {
      res.status(400).json({ error: 'Company website URL (company_url) is required' });
      return;
    }

    const numDays = Math.max(1, parseInt(days || '5', 10));
    const userId = req.user?.id || 'guest_user';

    const generatedKit = await orchestrator.runPipeline({
      jd: jd.trim(),
      companyUrl: company_url.trim(),
      days: numDays,
      companyName: company_name
    });

    const kitId = `kit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const stored: StoredKit = {
      id: kitId,
      userId,
      kit: generatedKit,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Always keep fallbackStore updated
    fallbackStore.saveKit(stored);

    // Primary persistence to MongoDB when connected
    if (isDbConnected()) {
      try {
        await Kit.create({
          _id: kitId,
          userId,
          kit: generatedKit,
          createdAt: now,
          updatedAt: now
        });
      } catch (dbErr: any) {
        console.warn(`[KitController] MongoDB write error: ${dbErr.message}`);
      }
    }

    res.status(201).json({
      id: kitId,
      kit: generatedKit
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate interview prep kit', details: err.message });
  }
}

export async function getKits(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'guest_user';

    if (isDbConnected()) {
      try {
        const dbKits = await Kit.find({ userId }).sort({ createdAt: -1 }).lean();
        if (dbKits && dbKits.length > 0) {
          res.json({
            kits: dbKits.map(k => ({
              id: k._id,
              role: k.kit.role.title,
              company: k.kit.source.company,
              company_url: k.kit.source.company_url,
              days: k.kit.schedule.days_available,
              requirementsCount: k.kit.role.requirements.length,
              questionsCount: k.kit.questions.length,
              createdAt: k.createdAt instanceof Date ? k.createdAt.toISOString() : k.createdAt,
              updatedAt: k.updatedAt instanceof Date ? k.updatedAt.toISOString() : k.updatedAt
            }))
          });
          return;
        }
      } catch (dbErr: any) {
        console.warn(`[KitController] MongoDB read error: ${dbErr.message}. Falling back.`);
      }
    }

    const kits = fallbackStore.findKitsByUserId(userId);
    res.json({
      kits: kits.map(k => ({
        id: k.id,
        role: k.kit.role.title,
        company: k.kit.source.company,
        company_url: k.kit.source.company_url,
        days: k.kit.schedule.days_available,
        requirementsCount: k.kit.role.requirements.length,
        questionsCount: k.kit.questions.length,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch kits', details: err.message });
  }
}

export async function getKitById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'guest_user';

    let foundKit: { id: string; userId: string; kit: AppendixAKit; createdAt: string; updatedAt: string } | null = null;

    if (isDbConnected()) {
      try {
        const dbDoc = await Kit.findById(id).lean() as any;
        if (dbDoc) {
          foundKit = {
            id: dbDoc._id,
            userId: dbDoc.userId,
            kit: dbDoc.kit,
            createdAt: dbDoc.createdAt instanceof Date ? dbDoc.createdAt.toISOString() : dbDoc.createdAt,
            updatedAt: dbDoc.updatedAt instanceof Date ? dbDoc.updatedAt.toISOString() : dbDoc.updatedAt
          };
        }
      } catch (dbErr: any) {
        console.warn(`[KitController] MongoDB findById error: ${dbErr.message}`);
      }
    }

    if (!foundKit) {
      const record = fallbackStore.findKitById(id);
      if (record) {
        foundKit = {
          id: record.id,
          userId: record.userId,
          kit: record.kit,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        };
      }
    }

    if (!foundKit) {
      res.status(404).json({ error: 'Prep kit not found' });
      return;
    }

    // Permission check: allow owner or guest session
    if (foundKit.userId !== userId && foundKit.userId !== 'guest_user' && userId !== 'guest_user') {
      res.status(403).json({ error: 'Access denied to this prep kit' });
      return;
    }

    res.json({
      id: foundKit.id,
      kit: foundKit.kit,
      createdAt: foundKit.createdAt,
      updatedAt: foundKit.updatedAt
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch kit details', details: err.message });
  }
}

export async function updateKit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { kit } = req.body;
    const userId = req.user?.id || 'guest_user';

    const now = new Date();

    // Update MongoDB
    if (isDbConnected()) {
      try {
        await Kit.findByIdAndUpdate(id, {
          $set: { kit, updatedAt: now }
        });
      } catch (dbErr: any) {
        console.warn(`[KitController] MongoDB update error: ${dbErr.message}`);
      }
    }

    // Update fallback store
    const record = fallbackStore.findKitById(id);
    if (record) {
      record.kit = kit;
      record.updatedAt = now.toISOString();
      fallbackStore.saveKit(record);
    }

    res.json({
      message: 'Kit updated successfully',
      id,
      kit
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update kit', details: err.message });
  }
}

export async function regenerateSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { target } = req.body;
    const userId = req.user?.id || 'guest_user';

    let currentKit: AppendixAKit | null = null;

    if (isDbConnected()) {
      const dbDoc = await Kit.findById(id).lean() as any;
      if (dbDoc) currentKit = dbDoc.kit;
    }

    if (!currentKit) {
      const record = fallbackStore.findKitById(id);
      if (record) currentKit = record.kit;
    }

    if (!currentKit) {
      res.status(404).json({ error: 'Prep kit not found' });
      return;
    }

    const kit = currentKit;

    if (target === 'schedule') {
      kit.schedule = allocateSchedule(kit.schedule.days_available, kit.questions, kit.role.requirements);
    } else if (target === 'brief') {
      kit.company_brief.summary = `Updated briefing for ${kit.source.company}. Core technical mission and team expectations refreshed.`;
    } else if (target.startsWith('questions:')) {
      const category = target.split(':')[1] as any;

      // Section 6 state preservation: keep edited, pinned, and custom questions
      const preservedQuestions = kit.questions.filter(q =>
        q.category !== category ||
        q.origin === 'edited' ||
        q.origin === 'pinned' ||
        q.origin === 'custom'
      );

      const targetReqs = kit.role.requirements.filter(r =>
        category === 'technical' ? r.kind === 'technical' :
        category === 'behavioural' ? r.kind === 'behavioural' :
        category === 'system-design' ? (r.kind === 'technical' || r.kind === 'domain') :
        true
      );

      const startIdx = kit.questions.length + 10;
      const freshQuestions: KitQuestion[] = targetReqs.slice(0, 3).map((req, i) => ({
        id: `q${startIdx + i}`,
        requirement_ids: [req.id],
        category,
        prompt: `[Regenerated ${category}] Deep dive: explain operational best practices and design choices for "${req.text}".`,
        answer_outline: `1. Key architectural patterns. 2. Failure modes and resiliency. 3. Code examples.`,
        difficulty: (req.priority === 'must' ? 3 : 2) as 1 | 2 | 3,
        origin: 'generated'
      }));

      kit.questions = [...preservedQuestions, ...freshQuestions];

      const cov = checkRequirementCoverage(kit.role.requirements, kit.questions);
      kit.coverage.uncovered_requirement_ids = cov.uncoveredRequirementIds;
      kit.schedule = allocateSchedule(kit.schedule.days_available, kit.questions, kit.role.requirements);
    } else {
      res.status(400).json({ error: `Unsupported regeneration target '${target}'` });
      return;
    }

    const now = new Date();

    if (isDbConnected()) {
      await Kit.findByIdAndUpdate(id, { $set: { kit, updatedAt: now } });
    }

    const rec = fallbackStore.findKitById(id);
    if (rec) {
      rec.kit = kit;
      rec.updatedAt = now.toISOString();
      fallbackStore.saveKit(rec);
    }

    res.json({
      message: `Section '${target}' regenerated successfully`,
      kit
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to regenerate section', details: err.message });
  }
}

export async function deleteKit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      await Kit.findByIdAndDelete(id);
    }

    fallbackStore.deleteKit(id);

    res.json({ message: 'Kit deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete kit', details: err.message });
  }
}
