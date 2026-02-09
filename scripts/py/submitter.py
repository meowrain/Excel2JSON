"""
submitter.py — 数据提交脚本

读取 enricher.py 输出的 JSON 文件，按批次提交到目标接口。
记录提交成功和失败的记录到单独的日志文件。

用法:
    python submitter.py enriched_data.json
    python submitter.py enriched_data.json --batch-size 100
    python submitter.py enriched_data.json --url https://api.example.com/import  # 覆盖 URL
    python submitter.py enriched_data.json --dry-run  # 只输出不提交
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

import aiohttp


async def submit_batch(
    session: aiohttp.ClientSession,
    url: str,
    method: str,
    batch: list[dict],
    batch_index: int,
    total_batches: int,
) -> tuple[bool, int, str, list[dict]]:
    """提交一个批次，返回 (success, status_code, response_text, batch_data)"""
    try:
        async with session.request(method, url, json=batch) as resp:
            status = resp.status
            body = await resp.text()
            ok = status < 400
            tag = "OK" if ok else "FAIL"
            print(f"  Batch {batch_index}/{total_batches}: HTTP {status} {tag} ({len(batch)} records)")
            return ok, status, body, batch
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  Batch {batch_index}/{total_batches}: ERROR - {msg} ({len(batch)} records)")
        return False, 0, msg, batch


async def main():
    parser = argparse.ArgumentParser(description="Submit enriched data to target API in batches.")
    parser.add_argument("input", help="Path to enriched JSON file (from enricher.py)")
    parser.add_argument("--url", type=str, default=None, help="Override target URL from config")
    parser.add_argument("--method", type=str, default=None, choices=["POST", "PUT"], help="Override HTTP method")
    parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be submitted without sending")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    data = payload.get("data", [])
    submission = payload.get("submission", {})

    target_url = args.url or submission.get("target_url", "")
    method = args.method or submission.get("method", "POST")
    batch_size = args.batch_size or submission.get("batch_size", 50)

    if not target_url:
        print("Error: No target URL configured. Use --url or set in job bundle.")
        sys.exit(1)

    print(f"=== Submitter ===")
    print(f"Input: {input_path} ({len(data)} records)")
    print(f"Target: {method} {target_url}")
    print(f"Batch size: {batch_size}")
    print()

    batches = [data[i : i + batch_size] for i in range(0, len(data), batch_size)]
    total_batches = len(batches)

    if args.dry_run:
        print(f"[DRY RUN] Would submit {len(data)} records in {total_batches} batch(es)")
        for i, batch in enumerate(batches, 1):
            print(f"  Batch {i}/{total_batches}: {len(batch)} records")
        print("\nDry run complete. No data was sent.")
        return

    success_records: list[dict] = []
    failed_records: list[dict] = []
    failed_details: list[dict] = []

    print(f"Submitting {len(data)} records in {total_batches} batch(es)...\n")

    async with aiohttp.ClientSession() as session:
        for i, batch in enumerate(batches, 1):
            ok, status, body, batch_data = await submit_batch(
                session, target_url, method, batch, i, total_batches
            )
            if ok:
                success_records.extend(batch_data)
            else:
                failed_records.extend(batch_data)
                failed_details.append({
                    "batch_index": i,
                    "status": status,
                    "response": body[:500],
                    "record_count": len(batch_data),
                })

    # 结果统计
    print()
    print(f"=== Result ===")
    print(f"Success: {len(success_records)} records")
    print(f"Failed:  {len(failed_records)} records")

    # 写入日志文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = input_path.stem

    if success_records:
        success_file = input_path.with_name(f"{base_name}_success_{timestamp}.json")
        with open(success_file, "w", encoding="utf-8") as f:
            json.dump(success_records, f, ensure_ascii=False, indent=2)
        print(f"\nSuccess log: {success_file}")

    if failed_records:
        failed_file = input_path.with_name(f"{base_name}_failed_{timestamp}.json")
        report = {
            "summary": {
                "total_failed": len(failed_records),
                "failed_batches": len(failed_details),
                "target_url": target_url,
                "timestamp": timestamp,
            },
            "batch_errors": failed_details,
            "failed_records": failed_records,
        }
        with open(failed_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"Failed log:  {failed_file}")
        print(f"\nTo retry failed records:")
        print(f'  python submitter.py {failed_file} --url "{target_url}"')
        # 生成一个可直接重试的文件
        retry_file = input_path.with_name(f"{base_name}_retry_{timestamp}.json")
        retry_payload = {
            "submission": submission,
            "data": failed_records,
        }
        with open(retry_file, "w", encoding="utf-8") as f:
            json.dump(retry_payload, f, ensure_ascii=False, indent=2)
        print(f"  or: python submitter.py {retry_file}")

    if not success_records and not failed_records:
        print("\nNo records to submit.")


if __name__ == "__main__":
    asyncio.run(main())
