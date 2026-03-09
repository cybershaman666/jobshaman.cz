import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.external_feed_warmup import run_external_feed_warmup


if __name__ == "__main__":
    result = run_external_feed_warmup()
    print(
        "🏁 External feed warmup completed. "
        f"Jooble runs={result.get('jooble_queries', 0)}, "
        f"WWR runs={result.get('wwr_queries', 0)}."
    )
