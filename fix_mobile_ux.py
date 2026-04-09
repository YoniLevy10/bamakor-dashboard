#!/usr/bin/env python3
import re

files_to_fix = ['app/tickets/page.tsx', 'app/page.tsx']

fixes = [
    # Fix 1: Change 100vh to 100dvh for drawer
    (r"(\s+height:\s*'100vh'[,\s]*background:\s*'#FFFFFF'[,\s]*borderLeft:\s*'1px solid rgba\(0,0,0,0\.08\)'[,\s]*zIndex:\s*60)", 
     lambda m:m.group(0).replace("height: '100vh'", "height: '100dvh'")),
    
    # Fix 2: Add safe area padding after drawer's padding
    (r"(drawer:\s*\{[^}]*padding:\s*'20px',)",
     r"\1\n    paddingTop: 'calc(20px + env(safe-area-inset-top))',"),
    
    # Fix 3: Update drawerMobile height and padding
    (r"drawerMobile:\s*\{[^}]*paddingTop:\s*'14px'",
     lambda m: m.group(0).replace("paddingTop: '14px'", "height: '100dvh !important',\n    paddingTop: 'env(safe-area-inset-top)'")),
]

for file_path in files_to_fix:
    print(f"Processing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    
    for pattern, replacement in fixes:
        if callable(replacement):
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        else:
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if len(content) != original_length:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Fixed {file_path}")
    else:
        print(f"⚠ No changes made to {file_path}")

print("Done!")
