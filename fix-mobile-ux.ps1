# Fix mobile UX issues

$files = @('app/tickets/page.tsx', 'app/page.tsx')

foreach ($file in $files) {
  Write-Host "Processing $file..."
  $content = Get-Content $file -Raw
  
  # Fix 1: Replace 100vh with 100dvh
  $content = $content -replace "height: '100vh'", "height: '100dvh'"
  
  # Fix 2: Add safe area padding to drawer (for the drawer style with padding: '20px')
  # This needs care to only affect the main drawer style
  $content = $content -replace "(`n\s+padding: '20px',)(`n\s+overflowY: 'auto',)", "`$1`n    paddingTop: 'calc(20px + env(safe-area-inset-top))',`$2"
  
  # Fix 3: Update drawerMobile - add height and safe area padding
  $content = $content -replace "drawerMobile: \{(`n\s+width[^}]+paddingTop: ')14px'", "drawerMobile: {`n    width: '100% !important',`n    height: '100dvh !important',`n    left: '0 !important',`n    right: 'auto !important',`n    borderRadius: '0',`n    padding: '0',`n    paddingTop: 'env(safe-area-inset-top)'"
  
  # Fix 4: Update drawerHeader - improve styling
  $content = $content -replace "drawerHeader: \{(`n\s+position: 'sticky',`n\s+top: 0,)`n(\s+background[^}]+)(paddingLeft[^}]+\},)", "drawerHeader: {`$1`n    zIndex: 50,`n`$2    minHeight: '50px',`n    paddingLeft: '16px',`n    paddingRight: '16px',`n  },"
  
  # Fix 5: Update drawerCloseButton - make it a proper back button
  $content = $content -replace "drawerCloseButton: \{`n\s+background: '#F9F9FA',`n\s+color: '#2F2F33',`n\s+border: '1px solid rgba\(0,0,0,0\.08\)',`n\s+borderRadius: '12px',`n\s+width: '40px',`n\s+height: '40px',`n\s+cursor: 'pointer',`n\s+fontSize: '16px',`n\s+flexShrink: 0,`n\s+\},", "drawerCloseButton: {`n    background: 'transparent',`n    color: '#111827',`n    border: 'none',`n    borderRadius: '8px',`n    width: '44px',`n    height: '44px',`n    cursor: 'pointer',`n    fontSize: '18px',`n    fontWeight: 700,`n    flexShrink: 0,`n    display: 'flex',`n    alignItems: 'center',`n    justifyContent: 'center',`n    order: -1,`n    transition: 'all 0.2s ease',`n  },"
  
  Set-Content $file $content
  Write-Host "✓ Fixed $file"
}

Write-Host "`nDone!"
