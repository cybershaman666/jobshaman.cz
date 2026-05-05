import os
import re

directories = ['src/rebuild', 'src/cybershaman']
replacements = {
    "'../../../hooks/": "'../../hooks/",
    "\"../../../hooks/": "\"../../hooks/",
    "'../../../services/": "'../../services/",
    "\"../../../services/": "\"../../services/",
    "'../../../utils/": "'../../utils/",
    "\"../../../utils/": "\"../../utils/",
    "'../../../types'": "'../../types'",
    "\"../../../types\"": "\"../../types\"",
    "'../../hooks/": "'../hooks/",
    "\"../../hooks/": "\"../hooks/",
    "'../../services/": "'../services/",
    "\"../../services/": "\"../services/",
    "'../../utils/": "'../utils/",
    "\"../../utils/": "\"../utils/",
    "'../../types'": "'../types'",
    "\"../../types\"": "\"../types\"",
}

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.ts') or f.endswith('.tsx'):
                path = os.path.join(root, f)
                with open(path, 'r') as file:
                    content = file.read()
                
                original_content = content
                for old, new in replacements.items():
                    content = content.replace(old, new)
                
                if content != original_content:
                    with open(path, 'w') as file:
                        file.write(content)
print("Imports fixed.")
