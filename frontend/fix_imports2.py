import os
import re

directories = ['src/rebuild', 'src/cybershaman']
targets = ['hooks', 'services', 'utils', 'types']

def replace_match(match):
    prefix = match.group(1)
    dots = match.group(2)
    target = match.group(3)
    
    # Count the number of '../'
    count = dots.count('../')
    
    # We want one less '../'
    if count > 1:
        new_dots = '../' * (count - 1)
    elif count == 1:
        new_dots = './'
    else:
        new_dots = dots # Should not happen based on regex but safe
        
    return f"{prefix}{new_dots}{target}"

# Regex explanation:
# Group 1: from ' or import ' or from " or import "
# Group 2: The sequence of ../
# Group 3: One of the target folders
regex = re.compile(r'(from\s+[\'"]|import\s+[\'"])((?:\.\./)+)(' + '|'.join(targets) + r')')

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.ts') or f.endswith('.tsx'):
                path = os.path.join(root, f)
                with open(path, 'r') as file:
                    content = file.read()
                
                new_content = regex.sub(replace_match, content)
                
                if new_content != content:
                    with open(path, 'w') as file:
                        file.write(new_content)
print("Imports fixed perfectly.")
