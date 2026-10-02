"""Prepare a private Claude config candidate; never overwrite live settings.
Rerun immediately before applying so concurrent user configuration is preserved.
"""
import argparse
import json
import os
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
old = 'https://eykyhucukwfepphxvajc.supabase.co/functions/v1/open-brain-mcp'
new = 'https://open-brain-neon.arpdale.workers.dev/mcp'
count = 0

def replace(value):
    global count
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key == 'url' and isinstance(item, str) and (item == old or item.startswith(old + '?')):
                result[key] = new + item[len(old):]
                count += 1
            else:
                result[key] = replace(item)
        return result
    if isinstance(value, list):
        return [replace(item) for item in value]
    return value

candidate = replace(json.loads(a.source.read_text()))
assert count > 0, 'No old MCP URLs found; inspect current configuration'
fd = os.open(a.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    json.dump(candidate, f, indent=2)
    f.write('\n')
print('Prepared private candidate with', count, 'MCP URL replacements; live settings unchanged')
