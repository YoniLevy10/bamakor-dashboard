#!/usr/bin/env python3
import re

files_to_fix = {
    'app/tickets/page.tsx': [
        # Replace close button with back button in drawer header
        {
            'name': 'Back button replacement',
            'pattern': r'(<button onClick=\{closeDrawer\} style=\{styles\.drawerCloseButton\}>)\s*✕\s*(<\/button>)',
            'replacement': r'\1{isMobile ? "← Back" : "✕"}\2'
        },
        # Add attachment fallback message
        {
            'name': 'Attachment fallback',
            'pattern': r'(\{selectedTicketAttachments\.length > 0 && \(.*?<\/div>\s*\)\})',
            'replacement': r'<div style={styles.drawerSection}>\n              <div style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\', marginBottom: \'12px\' }}>\n                <div style={styles.drawerLabel}>📷 Attachments</div>\n                {selectedTicketAttachments.length > 0 && (\n                  <span style={{ fontSize: \'11px\', background: \'#FEF2F2\', color: \'#C1121F\', padding: \'2px 6px\', borderRadius: \'4px\', fontWeight: 700 }}>\n                    {selectedTicketAttachments.length}\n                  </span>\n                )}\n              </div>\n              {loadingAttachments ? (\n                <div style={{ fontSize: \'13px\', color: \'#6B7280\' }}>Loading images...</div>\n              ) : selectedTicketAttachments.length > 0 ? (\n                <div style={styles.attachmentGrid}>\n                  {selectedTicketAttachments.map((attachment) => (\n                    <button\n                      key={attachment.id}\n                      onClick={() => setSelectedImageUrl(getImageUrl(attachment))}\n                      style={styles.attachmentThumbnail}\n                      title={attachment.file_name}\n                    >\n                      <img\n                        src={getImageUrl(attachment)}\n                        alt={attachment.file_name}\n                        style={styles.attachmentImg}\n                      />\n                    </button>\n                  ))}\n                </div>\n              ) : (\n                <div style={{ fontSize: \'13px\', color: \'#9CA3AF\' }}>No images attached</div>\n              )}\n            </div>'
        }
    ],
    'app/page.tsx': [
        # Replace close button with back button in dashboard drawer header
        {
            'name': 'Back button replacement',
            'pattern': r'(<button\s+onClick=\{[^}]+\}\s+style=\{styles\.drawerCloseButton\}\s*>)\s*✕\s*(<\/button>)',
            'replacement': r'\1{isMobile ? "← Back" : "✕"}\2'
        },
    ]
}

for file_path, fixes in files_to_fix.items():
    print(f"\nProcessing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    
    for fix in fixes:
        print(f"  Applying: {fix['name']}...", end=' ')
        try:
            new_content = re.sub(fix['pattern'], fix['replacement'], content, flags=re.DOTALL)
            if new_content != content:
                content = new_content
                print("✓")
            else:
                print("(no match)")
        except Exception as e:
            print(f"✗ Error: {str(e)}")
    
    if len(content) != original_length:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ File updated")
    else:
        print(f"⚠ No changes made to {file_path}")

print("\nDone!")
