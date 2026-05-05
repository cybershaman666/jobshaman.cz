import os

def keep_bottom(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    if '<<<<<<< HEAD' in content:
        # keep the part between ======= and >>>>>>>
        parts = content.split('=======')
        if len(parts) > 1:
            bottom = parts[1].split('>>>>>>>')[0]
            if bottom.startswith('\n'):
                bottom = bottom[1:]
            with open(filepath, 'w') as f:
                f.write(bottom)
            print(f"Kept bottom for {filepath}")

def keep_top(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    if '<<<<<<< HEAD' in content:
        # keep the part between <<<<<<< HEAD and =======
        parts = content.split('<<<<<<< HEAD')
        if len(parts) > 1:
            top = parts[1].split('=======')[0]
            if top.startswith('\n'):
                top = top[1:]
            with open(filepath, 'w') as f:
                f.write(top)
            print(f"Kept top for {filepath}")

base = '/home/misha/Projekty (2)/jobshaman-new/jobshaman'

keep_bottom(os.path.join(base, 'backend/app/core/database.py'))
keep_bottom(os.path.join(base, 'backend/app/main.py'))
keep_top(os.path.join(base, 'backend/app/models/requests.py'))
keep_top(os.path.join(base, 'backend/app/services/job_signal_boost_store.py'))
