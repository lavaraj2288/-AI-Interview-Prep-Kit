import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runPrepKitPipeline } from '../server/src/services/pipeline/orchestrator.js';
import {
  BatchCaseInput,
  BatchCaseResult,
  BatchOutput,
} from '../server/src/types/kit.js';

// Load environment variables from .env
dotenv.config();

function parseArgs(args: string[]): { input: string; output: string } {
  let input = '';
  let output = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      input = args[i + 1] || '';
      i++;
    } else if (arg.startsWith('--input=')) {
      input = arg.split('=')[1];
    } else if (arg === '--output' || arg === '-o') {
      output = args[i + 1] || '';
      i++;
    } else if (arg.startsWith('--output=')) {
      output = arg.split('=')[1];
    } else if (!arg.startsWith('-') && !input) {
      input = arg;
    } else if (!arg.startsWith('-') && !output) {
      output = arg;
    }
  }

  return { input, output };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { input, output } = parseArgs(rawArgs);

  if (!input || !output) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    console.error('   or: tsx scripts/evaluate.ts --input <cases.json> --output <kits.json>');
    console.error('Received args:', rawArgs);
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), input);
  const outputPath = path.resolve(process.cwd(), output);

  console.log(`[Batch Evaluator] Starting evaluation...`);
  console.log(`[Batch Evaluator] Input file:  ${inputPath}`);
  console.log(`[Batch Evaluator] Output file: ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file does not exist at ${inputPath}`);
    process.exit(1);
  }

  let cases: BatchCaseInput[];
  try {
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    cases = JSON.parse(rawData);
    if (!Array.isArray(cases)) {
      throw new Error('Input JSON must be an array of cases.');
    }
  } catch (err) {
    console.error(`Error parsing input JSON: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`[Batch Evaluator] Loaded ${cases.length} case(s). Processing...`);

  const results: BatchCaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[Case ${i + 1}/${cases.length}] ID: ${item.id} | Days: ${item.days} | Company: ${item.company_url}`);

    try {
      const pipelineResult = await runPrepKitPipeline({
        jd: item.jd,
        companyUrl: item.company_url,
        days: item.days,
        onProgress: (step, total, title, detail) => {
          console.log(`  [Step ${step}/${total}] ${title}: ${detail}`);
        },
      });

      if (pipelineResult.success && pipelineResult.kit) {
        console.log(`  ✓ Case ${item.id} SUCCEEDED. (Passes: ${pipelineResult.kit.coverage.passes}, Questions: ${pipelineResult.kit.questions.length})`);
        results.push({
          id: item.id,
          status: 'ok',
          kit: pipelineResult.kit,
          error: null,
        });
      } else {
        const errCode = pipelineResult.error?.code || 'PIPELINE_ERROR';
        const errMsg = pipelineResult.error?.message || 'Pipeline failed to produce kit.';
        console.warn(`  ✗ Case ${item.id} FAILED: [${errCode}] ${errMsg}`);
        results.push({
          id: item.id,
          status: 'failed',
          kit: null,
          error: {
            code: errCode,
            message: errMsg,
          },
        });
      }
    } catch (err) {
      console.error(`  ✗ Case ${item.id} UNEXPECTED EXCEPTION:`, err);
      results.push({
        id: item.id,
        status: 'failed',
        kit: null,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  const batchOutput: BatchOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };

  // Ensure target directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(batchOutput, null, 2), 'utf-8');
  console.log(`\n==================================================`);
  console.log(`[Batch Evaluator] Successfully completed ${cases.length} cases.`);
  console.log(`[Batch Evaluator] Output written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('[Batch Evaluator] Fatal error:', err);
  process.exit(1);
});
