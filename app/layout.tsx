import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Documentation Tracker',description:'Read-only GitHub change analysis, immutable evidence, and cross-team acceptance testing.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
