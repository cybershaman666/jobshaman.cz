from __future__ import annotations

import argparse
import json

from .orchestrator import JobAgentService


def main() -> None:
    parser = argparse.ArgumentParser(description="Local Ollama job agent")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser("fetch")
    fetch_parser.add_argument("--limit", type=int, default=None)

    rec_parser = subparsers.add_parser("recommend")
    rec_parser.add_argument("--limit", type=int, default=None)
    rec_parser.add_argument("--no-llm", action="store_true")

    draft_parser = subparsers.add_parser("draft")
    draft_parser.add_argument("job_id")
    draft_parser.add_argument("--no-llm", action="store_true")

    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("job_id")
    apply_parser.add_argument("--no-llm", action="store_true")

    args = parser.parse_args()
    service = JobAgentService()

    if args.command == "fetch":
        print(json.dumps(service.fetch_all_jobs(limit=args.limit), ensure_ascii=False, indent=2))
        return
    if args.command == "recommend":
        items = service.recommend(limit=args.limit, use_llm=not args.no_llm)
        print(json.dumps([item.model_dump(mode="json") for item in items], ensure_ascii=False, indent=2))
        return
    if args.command == "draft":
        print(json.dumps(service.draft(args.job_id, use_llm=not args.no_llm).model_dump(mode="json"), ensure_ascii=False, indent=2))
        return
    if args.command == "apply":
        print(json.dumps(service.apply(args.job_id, use_llm=not args.no_llm).model_dump(mode="json"), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
