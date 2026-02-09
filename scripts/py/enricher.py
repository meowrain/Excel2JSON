"""
enricher.py — API 数据补全脚本

读取前端生成的 job_bundle.json，执行 enrichment_rules 中的 API 请求，
将结果合并到 source_data 中，输出最终完整的 JSON 文件。

用法:
    python enricher.py job_bundle.json
    python enricher.py job_bundle.json -o enriched_data.json
    python enricher.py job_bundle.json --concurrency 10
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

import aiohttp


def resolve_path(obj, path: str):
    """按点号路径从 dict/list 中取值，类似 lodash.get"""
    keys = path.split(".")
    current = obj
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        elif isinstance(current, list):
            try:
                current = current[int(key)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current


def render_template(template: str, row: dict) -> str:
    """将 {{变量名}} 替换为行数据中的对应值"""
    def replacer(match: re.Match) -> str:
        key = match.group(1)
        value = row.get(key, "")
        return str(value) if value is not None else ""

    return re.sub(r"\{\{(.+?)\}\}", replacer, template)


async def fetch_one(
    session: aiohttp.ClientSession,
    rule: dict,
    row: dict,
    row_index: int,
    semaphore: asyncio.Semaphore,
) -> tuple[int, str, object]:
    """对单行数据执行一条 enrichment rule 的 API 请求"""
    target_key = rule["target_key"]
    fallback = rule.get("fallback_value")

    url = render_template(rule["url_template"], row)

    headers = {}
    if rule.get("headers"):
        for k, v in rule["headers"].items():
            headers[k] = render_template(v, row)

    method = rule.get("method", "GET").upper()

    body = None
    if method == "POST" and rule.get("body_template"):
        body = render_template(rule["body_template"], row)

    async with semaphore:
        try:
            kwargs: dict = {"headers": headers}
            if body is not None:
                try:
                    kwargs["json"] = json.loads(body)
                except json.JSONDecodeError:
                    kwargs["data"] = body

            async with session.request(method, url, **kwargs) as resp:
                if resp.status >= 400:
                    print(f"  [WARN] Row {row_index} | {target_key} | HTTP {resp.status} <- {url}")
                    return row_index, target_key, fallback

                data = await resp.json(content_type=None)
                value = resolve_path(data, rule["response_path"])
                if value is None:
                    value = fallback
                return row_index, target_key, value

        except Exception as e:
            print(f"  [ERROR] Row {row_index} | {target_key} | {type(e).__name__}: {e}")
            return row_index, target_key, fallback


async def run_enrichments(
    source_data: list[dict],
    rules: list[dict],
    concurrency: int,
) -> list[dict]:
    """对所有行执行所有 enrichment rules"""
    if not rules:
        print("No enrichment rules configured. Outputting source data as-is.")
        return source_data

    semaphore = asyncio.Semaphore(concurrency)
    tasks = []

    total_calls = len(source_data) * len(rules)
    print(f"Enriching {len(source_data)} rows x {len(rules)} rule(s) = {total_calls} API calls")
    print(f"Concurrency: {concurrency}")
    print()

    async with aiohttp.ClientSession() as session:
        for row_idx, row in enumerate(source_data):
            for rule in rules:
                tasks.append(fetch_one(session, rule, row, row_idx, semaphore))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    error_count = 0
    for result in results:
        if isinstance(result, Exception):
            print(f"  [ERROR] Unexpected: {result}")
            error_count += 1
            continue
        row_idx, target_key, value = result
        source_data[row_idx][target_key] = value

    print()
    print(f"Done. {total_calls - error_count}/{total_calls} calls succeeded.")
    return source_data


async def main():
    parser = argparse.ArgumentParser(description="Enrich job_bundle.json with API data and output final JSON.")
    parser.add_argument("bundle", help="Path to job_bundle.json")
    parser.add_argument("-o", "--output", type=str, default=None, help="Output file path (default: <bundle>_enriched.json)")
    parser.add_argument("--concurrency", type=int, default=5, help="Max concurrent API requests (default: 5)")
    args = parser.parse_args()

    bundle_path = Path(args.bundle)
    if not bundle_path.exists():
        print(f"Error: File not found: {bundle_path}")
        sys.exit(1)

    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    meta = bundle.get("meta", {})
    config = bundle.get("config", {})
    source_data = bundle.get("source_data", [])

    print(f"=== Job Bundle v{meta.get('version', '?')} ===")
    print(f"Generated: {meta.get('generated_at', '?')}")
    print(f"Rows: {len(source_data)}")
    print(f"Static rules: {len(config.get('static_rules', []))}")
    print(f"Enrichment rules: {len(config.get('enrichment_rules', []))}")
    print()

    enriched = await run_enrichments(
        source_data,
        config.get("enrichment_rules", []),
        args.concurrency,
    )

    # 构建输出，保留 submission 配置
    output = {
        "meta": meta,
        "submission": config.get("submission", {}),
        "data": enriched,
    }

    output_path = Path(args.output) if args.output else bundle_path.with_name(bundle_path.stem + "_enriched.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nEnriched data saved to: {output_path}")
    print(f"Next step: python submitter.py {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
