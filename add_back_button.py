#!/usr/bin/env python3
import re

files_to_fix = ['app/tickets/page.tsx', 'app/page.tsx']

for file_path in files_to_fix:
    print(f"Processing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified = False
    new_lines = []
    
    for i, line in enumerate(lines):
        # Look for drawerCloseButton and replace the icon
        if 'onClick={closeDrawer}' in line or 'onClick={() => setSelectedTicket(null)}' in line:
            # Check if next few lines have the close button
            if i + 1 < len(lines) and 'drawerCloseButton' in lines[i + 1]:
                # In next iteration, modify the button content
                pass
        
        # Replace the X button content  
        if line.strip() == '✕' and i > 0 and 'drawerCloseButton' in lines[i-1]:
            # Find isMobile variable to use conditional
            new_lines.append('                {isMobile ? \'← Back\' : \'✕\'}\n')
            modified = True
            continue
        
        # Update drawerCloseButton styling
        if 'drawerCloseButton: {' in line:
            new_lines.append(line)
            # Read and replace the entire style until we find the closing brace
            j = i + 1
            style_lines = [line]
            brace_count = 0
            in_style = True
            
            while j < len(lines) and in_style:
                style_line = lines[j]
                if '{' in style_line:
                    brace_count += 1
                if '}' in style_line:
                    brace_count -= 1
                    if brace_count < 0:
                        # End of drawerCloseButton style
                        # Replace old styling with new
                        new_style = """  drawerCloseButton: {
    background: 'transparent',
    color: '#111827',
    border: 'none',
    borderRadius: '8px',
    width: '44px',
    height: '44px',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 700,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    order: -1,
    transition: 'all 0.2s ease',
  },
"""
                        # Skip the old style lines
                        new_lines = new_lines[:-1]  # Remove the "drawerCloseButton: {" we just added
                        new_lines.append(new_style)
                        modified = True
                        in_style = False
                        # Continue from next line after this style
                        i = j
                j += 1
            continue
        
        new_lines.append(line)
    
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"✓ Fixed {file_path}")
    else:
        print(f"⚠ No modifications for {file_path}")

print("Done!")
