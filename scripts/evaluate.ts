import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { KitPipelineOrchestrator } from '../server/src/services/pipeline/orchestrator.js';
import { BatchInputCase, BatchOutputDocument, BatchOutputResult } from '../server/src/types/kit.js';

dotenv.config();

// Ensure local addresses like localhost:8099 are permitted during evaluate runs
process.env.ALLOW_LOCAL_URLS = 'true';

async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i] === '-i') && i + 1 < args.length) {
      inputPath = args[i + 1];
      i++;
    } else if ((args[i] === '--output' || args[i] === '-o') && i + 1 < args.length) {
      outputPath = args[i + 1];
      i++;
    }
  }

  // Fallback to positional arguments if flags were consumed or omitted by shell
  if (!inputPath && args.length >= 2) {
    inputPath = args[0];
    outputPath = args[1];
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const resolvedOutput = path.resolve(process.cwd(), outputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Input file not found at ${resolvedInput}`);
    process.exit(1);
  }

  let cases: BatchInputCase[];
  try {
    const rawInput = fs.readFileSync(resolvedInput, 'utf-8');
    cases = JSON.parse(rawInput);
    if (!Array.isArray(cases)) {
      throw new Error('Input file must contain a JSON array of case objects.');
    }
  } catch (err: any) {
    console.error(`Error reading input JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`[Batch Evaluate] Processing ${cases.length} case(s)...`);
  console.log(`======================================================\n`);

  const orchestrator = new KitPipelineOrchestrator();
  const results: BatchOutputResult[] = [];

  for (let idx = 0; idx < cases.length; idx++) {
    const item = cases[idx];
    console.log(`--> [${idx + 1}/${cases.length}] Evaluating case ID: "${item.id}" (Company: ${item.company_url}, Days: ${item.days})`);

    try {
      if (!item.jd || typeof item.jd !== 'string') {
        throw new Error('Missing or invalid job description string');
      }

      const kit = await orchestrator.runPipeline({
        jd: item.jd,
        companyUrl: item.company_url || 'https://example.com',
        days: typeof item.days === 'number' ? item.days : 5,
        onProgress: (step, percent, details) => {
          // Keep stdout concise but informative
          if (percent === 15 || percent === 55 || percent === 85 || percent === 100) {
            console.log(`    [${percent}%] ${details}`);
          }
        }
      });

      results.push({
        id: item.id,
        status: 'ok',
        kit,
        error: null
      });

      console.log(`    ✓ Case "${item.id}" completed successfully.\n`);
    } catch (caseErr: any) {
      console.warn(`    ✗ Case "${item.id}" failed: ${caseErr.message}\n`);
      results.push({
        id: item.id,
        status: 'failed',
        kit: null,
        error: {
          code: caseErr.code || 'GENERATION_FAILED',
          message: caseErr.message || 'Pipeline encountered a fatal error during kit generation.'
        }
      });
    }
  }

  const outputDoc: BatchOutputDocument = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results
  };

  try {
    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOutput, JSON.stringify(outputDoc, null, 2), 'utf-8');
    console.log(`======================================================`);
    console.log(`[Batch Evaluate] Finished! Wrote results to: ${resolvedOutput}`);
    console.log(`Success: ${results.filter(r => r.status === 'ok').length}/${cases.length}`);
    console.log(`Failed:  ${results.filter(r => r.status === 'failed').length}/${cases.length}`);
    console.log(`======================================================\n`);
  } catch (err: any) {
    console.error(`Failed to write output file: ${err.message}`);
    process.exit(1);
  }
}

main();
