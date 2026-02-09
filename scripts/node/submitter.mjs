/**
 * submitter.mjs — 数据提交脚本 (Node.js)
 *
 * 读取 enricher.mjs 输出的 JSON 文件，按批次提交到目标接口。
 * 记录提交成功和失败的记录到单独的日志文件。
 *
 * 用法:
 *   node submitter.mjs enriched_data.json
 *   node submitter.mjs enriched_data.json --batch-size 100
 *   node submitter.mjs enriched_data.json --url https://api.example.com/import
 *   node submitter.mjs enriched_data.json --dry-run
 */

import { readFileSync, writeFileSync } from "fs";

// ── args ──

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: "", url: "", method: "", batchSize: 0, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") {
      opts.url = args[++i];
    } else if (args[i] === "--method") {
      opts.method = args[++i];
    } else if (args[i] === "--batch-size") {
      opts.batchSize = Number(args[++i]) || 0;
    } else if (args[i] === "--dry-run") {
      opts.dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node submitter.mjs <enriched.json> [--url URL] [--method POST|PUT] [--batch-size N] [--dry-run]");
      process.exit(0);
    } else if (!opts.input) {
      opts.input = args[i];
    }
  }
  if (!opts.input) {
    console.error("Error: Please provide an enriched JSON file path.");
    console.error("Usage: node submitter.mjs <enriched.json>");
    process.exit(1);
  }
  return opts;
}

// ── submit ──

async function submitBatch(url, method, batch, batchIndex, totalBatches) {
  try {
    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    const body = await resp.text();
    const ok = resp.status < 400;
    const tag = ok ? "OK" : "FAIL";
    console.log(`  Batch ${batchIndex}/${totalBatches}: HTTP ${resp.status} ${tag} (${batch.length} records)`);
    return { ok, status: resp.status, body, data: batch };
  } catch (e) {
    const msg = e.message;
    console.log(`  Batch ${batchIndex}/${totalBatches}: ERROR - ${msg} (${batch.length} records)`);
    return { ok: false, status: 0, body: msg, data: batch };
  }
}

// ── main ──

async function main() {
  const opts = parseArgs();

  const raw = readFileSync(opts.input, "utf-8");
  const payload = JSON.parse(raw);

  const data = payload.data || [];
  const submission = payload.submission || {};

  const targetUrl = opts.url || submission.target_url || "";
  const method = (opts.method || submission.method || "POST").toUpperCase();
  const batchSize = opts.batchSize || submission.batch_size || 50;

  if (!targetUrl) {
    console.error("Error: No target URL configured. Use --url or set in job bundle.");
    process.exit(1);
  }

  console.log("=== Submitter ===");
  console.log(`Input: ${opts.input} (${data.length} records)`);
  console.log(`Target: ${method} ${targetUrl}`);
  console.log(`Batch size: ${batchSize}`);
  console.log();

  // 分批
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  const totalBatches = batches.length;

  if (opts.dryRun) {
    console.log(`[DRY RUN] Would submit ${data.length} records in ${totalBatches} batch(es)`);
    for (let i = 0; i < batches.length; i++) {
      console.log(`  Batch ${i + 1}/${totalBatches}: ${batches[i].length} records`);
    }
    console.log("\nDry run complete. No data was sent.");
    return;
  }

  /** @type {object[]} */
  const successRecords = [];
  /** @type {object[]} */
  const failedRecords = [];
  /** @type {object[]} */
  const failedDetails = [];

  console.log(`Submitting ${data.length} records in ${totalBatches} batch(es)...\n`);

  for (let i = 0; i < batches.length; i++) {
    const result = await submitBatch(targetUrl, method, batches[i], i + 1, totalBatches);
    if (result.ok) {
      successRecords.push(...result.data);
    } else {
      failedRecords.push(...result.data);
      failedDetails.push({
        batch_index: i + 1,
        status: result.status,
        response: result.body.slice(0, 500),
        record_count: result.data.length,
      });
    }
  }

  // 结果统计
  console.log();
  console.log("=== Result ===");
  console.log(`Success: ${successRecords.length} records`);
  console.log(`Failed:  ${failedRecords.length} records`);

  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const baseName = opts.input.replace(/\.json$/i, "");

  if (successRecords.length > 0) {
    const successFile = `${baseName}_success_${timestamp}.json`;
    writeFileSync(successFile, JSON.stringify(successRecords, null, 2), "utf-8");
    console.log(`\nSuccess log: ${successFile}`);
  }

  if (failedRecords.length > 0) {
    const failedFile = `${baseName}_failed_${timestamp}.json`;
    const report = {
      summary: {
        total_failed: failedRecords.length,
        failed_batches: failedDetails.length,
        target_url: targetUrl,
        timestamp,
      },
      batch_errors: failedDetails,
      failed_records: failedRecords,
    };
    writeFileSync(failedFile, JSON.stringify(report, null, 2), "utf-8");
    console.log(`Failed log:  ${failedFile}`);

    const retryFile = `${baseName}_retry_${timestamp}.json`;
    const retryPayload = { submission, data: failedRecords };
    writeFileSync(retryFile, JSON.stringify(retryPayload, null, 2), "utf-8");
    console.log(`\nTo retry failed records:`);
    console.log(`  node submitter.mjs ${retryFile}`);
  }

  if (successRecords.length === 0 && failedRecords.length === 0) {
    console.log("\nNo records to submit.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
