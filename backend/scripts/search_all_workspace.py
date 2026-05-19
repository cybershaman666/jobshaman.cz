import os
import sys

workspace_dir = "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
search_terms = ["řetěz", "spustí", "řetězový"]

print("Walking workspace...")
matches = []
for root, dirs, files in os.walk(workspace_dir):
    # Skip environment, git, and build folders
    if any(p in root for p in [".git", ".venv", "node_modules", "dist", "build", "__pycache__"]):
        continue
    for f in files:
        file_path = os.path.join(root, f)
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                content = fh.read()
                for term in search_terms:
                    if term in content:
                        matches.append((file_path, term))
        except Exception:
            pass

print(f"Found {len(matches)} matches:")
for file_path, term in matches:
    print(f"- {file_path} (matched '{term}')")
