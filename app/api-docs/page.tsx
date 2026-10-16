import type { Metadata } from 'next';
import ApiGuide from './api-guide';
import './api-docs.css';

export const metadata: Metadata = {
  title: 'API guide | Documentation Tracker',
  description: 'Readable endpoint reference, editable request examples, and a Phase 3 submission checklist.',
};

export default function ApiDocsPage() { return <ApiGuide />; }
