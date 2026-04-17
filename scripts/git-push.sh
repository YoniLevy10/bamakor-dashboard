#!/bin/bash
cd /vercel/share/v0-project
git add -A
git commit -m "Complete dashboard redesign with Apple-inspired UI

- Updated design system with new color palette and typography
- Added Bamakor logo to sidebar navigation
- Redesigned all 6 pages: Dashboard, Tickets, Projects, Workers, QR, Summary
- Added Skeleton loading components for better UX
- Added ErrorState and EmptyState components
- Improved card designs with subtle shadows and hover effects
- Enhanced mobile responsiveness"
git push origin dashboard-redesign
