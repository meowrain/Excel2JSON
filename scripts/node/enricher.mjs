/**
 * enricher.mjs — API 数据补全脚本 (Node.js)
 *
 * 读取前端生成的 job_bundle.json，执行 enrichment_rules 中的 API 请求，
 * 将结果合并到 source_data 中，输出最终完整的 JSON 文件。
 *
 * 用法:
 *   node enricher.mjs job_bundle.json
 *   node enricher.mjs job_bundle.json -o enriched_data.json
 *   node enricher.mjs job_bundle.json --concurrency 10
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, join, dirname } from "path";

// ── helpers ──

function resolvePath(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return null;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (Number.isNaN(idx) || idx < 0 || idx >= current.length) return null;
      current = current[idx];
    } else if (typeof current === "object") {
      current = current[key];
    } else {
      return null;
    }
  }
  return current ?? null;
}

function renderTemplate(template, row) {
  return template.replace(/\{\{(.+?)\}\}/g, (_, key) => {
    const val = row[key];
    return val != null ? String(val) : "";
  });
}

// ── fetch one ──

async function fetchOne(rule, row, rowIndex, semaphore) {
  const targetKey = rule.target_key;
  const fallback = rule.fallback_value ?? null;
  const url = renderTemplate(rule.url_template, row);
  const method = (rule.method || "GET").toUpperCase();

  const headers = {};
  if (rule.headers) {
    for (const [k, v] of Object.entries(rule.headers)) {
      headers[k] = renderTemplate(v, row);
    }
  }

  /** @type {RequestInit} */
  const opts = { method, headers };

  if (method === "POST" && rule.body_template) {
    const body = renderTemplate(rule.body_template, row);
    try {
      JSON.parse(body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      opts.body = body;
    } catch {
      opts.body = body;
    }
  }

  await semaphore.acquire();
  try {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      console.log(`  [WARN] Row ${rowIndex} | ${targetKey} | HTTP ${resp.status} <- ${url}`);
      return { rowIndex, targetKey, value: fallback };
    }
    const data = await resp.json();
    const value = resolvePath(data, rule.response_path);
    return { rowIndex, targetKey, value: value ?? fallback };
  } catch (e) {
    console.log(`  [ERROR] Row ${rowIndex} | ${targetKey} | ${e.message}`);
    return { rowIndex, targetKey, value: fallback };
  } finally {
    semaphore.release();
  }
}

// ── semaphore ──

function createSemaphore(max) {
  let current = 0;
  /** @type {(() => void)[]} */
  const queue = [];
  return {
    acquire() {
      if (current < max) {
        current++;
        return Promise.resolve();
      }
      return new Promise((resolve) => queue.push(resolve));
    },
    release() {
      current--;
      if (queue.length > 0) {
        current++;
        queue.shift()();
      }
    },
  };
}

// ── main ──

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { bundle: "", output: "", concurrency: 5 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--output") {
      opts.output = args[++i];
    } else if (args[i] === "--concurrency") {
      opts.concurrency = Number(args[++i]) || 5;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node enricher.mjs <job_bundle.json> [-o output.json] [--concurrency N]");
      process.exit(0);
    } else if (!opts.bundle) {
      opts.bundle = args[i];
    }
  }
  if (!opts.bundle) {
    console.error("Error: Please provide a job_bundle.json path.");
    console.error("Usage: node enricher.mjs <job_bundle.json>");
    process.exit(1);
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  const raw = readFileSync(opts.bundle, "utf-8");
  const bundle = JSON.parse(raw);

  const meta = bundle.meta || {};
  const config = bundle.config || {};
  const sourceData = bundle.source_data || [];
  const rules = config.enrichment_rules || [];

  console.log(`=== Job Bundle v${meta.version || "?"} ===`);
  console.log(`Generated: ${meta.generated_at || "?"}`);
  console.log(`Rows: ${sourceData.length}`);
  console.log(`Static rules: ${(config.static_rules || []).length}`);
  console.log(`Enrichment rules: ${rules.length}`);
  console.log();

  if (rules.length === 0) {
    console.log("No enrichment rules configured. Outputting source data as-is.");
  } else {
    const totalCalls = sourceData.length * rules.length;
    console.log(`Enriching ${sourceData.length} rows x ${rules.length} rule(s) = ${totalCalls} API calls`);
    console.log(`Concurrency: ${opts.concurrency}`);
    console.log();

    const semaphore = createSemaphore(opts.concurrency);
    const tasks = [];
    for (let rowIdx = 0; rowIdx < sourceData.length; rowIdx++) {
      for (const rule of rules) {
        tasks.push(fetchOne(rule, sourceData[rowIdx], rowIdx, semaphore));
      }
    }

    const results = await Promise.all(tasks);

    let errorCount = 0;
    for (const r of results) {
      if (r.value === undefined) errorCount++;
      sourceData[r.rowIndex][r.targetKey] = r.value;
    }

    console.log();
    console.log(`Done. ${totalCalls - errorCount}/${totalCalls} calls succeeded.`);
  }

  const output = {
    meta,
    submission: config.submission || {},
    data: sourceData,
  };

  const outName = opts.output || opts.bundle.replace(/\.json$/i, "_enriched.json");
  writeFileSync(outName, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\nEnriched data saved to: ${outName}`);
  console.log(`Next step: node submitter.mjs ${outName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
