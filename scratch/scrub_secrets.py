import os
import re

filepath = '/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/.env.example'

with open(filepath, 'r') as f:
    content = f.read()

# Extract the incoming (bottom) part
parts = content.split('=======')
if len(parts) > 1:
    bottom = parts[1].split('>>>>>>>')[0]
    if bottom.startswith('\n'):
        bottom = bottom[1:]
    
    # Scrub secrets
    lines = bottom.split('\n')
    scrubbed_lines = []
    for line in lines:
        if '=' in line:
            key, val = line.split('=', 1)
            # Scrub values that look like secrets (long base64, sk_, whsec_, re_, etc)
            # Actually, let's just scrub everything except booleans, simple URLs, or short ints
            if len(val) > 20 and not val.startswith('http') and not val.startswith('"http'):
                val = '"<SECRET>"'
            elif 'KEY' in key or 'SECRET' in key or 'PASSWORD' in key:
                val = '"<SECRET>"'
            scrubbed_lines.append(f"{key}={val}")
        else:
            scrubbed_lines.append(line)
            
    with open(filepath, 'w') as f:
        f.write('\n'.join(scrubbed_lines))
    print(f"Scrubbed secrets and resolved conflict in {filepath}")
else:
    print("No conflict markers found, maybe already resolved?")
