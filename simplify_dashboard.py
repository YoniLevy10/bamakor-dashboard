#!/usr/bin/env python3
import re

file_path = 'app/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Reduce KPI card mobile styles
changes = [
    # Reduce statsGrid gap
    (r"(statsGrid:\s*\{[^}]*gap:\s*)'14px'", r"\1'10px'"),
    
    # Reduce kpiCardMobile padding and minHeight  
    (r"(kpiCardMobile:\s*\{[^}]*padding:\s*)'16px'", r"\1'12px'"),
    (r"(kpiCardMobile:\s*\{[^}]*minHeight:\s*)'118px'", r"\1'100px'"),
    
    # Reduce mainAreaMobile padding
    (r"(mainAreaMobile:\s*\{[^}]*padding:\s*)'16px'", r"\1'12px'"),
]

for pattern, replacement in changes:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Also reduce kpiLabel and kpiValue sizes on mobile by adding mobile-specific overrides in JSX
# This part would need JSX changes, so let's just update the styles we can

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Dashboard mobile styling simplified")
