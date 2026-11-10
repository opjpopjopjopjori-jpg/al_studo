import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface NoteMeta {
  doctorName: string;
  docType: string;
  mainTitle: string;
  subtitle: string;
}

interface DoctorNoteTemplateProps {
  meta: NoteMeta;
  content: string;
}

export default function DoctorNoteTemplate({ meta, content }: DoctorNoteTemplateProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 sm:p-16 shadow-lg min-h-[1056px] text-slate-800 font-sans print:shadow-none print:p-0">
      {/* Document Header */}
      <div className="text-center mb-16">
        <p className="uppercase tracking-[0.2em] text-xs font-semibold text-slate-500 mb-6">
          {meta.doctorName} • {meta.docType}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
          {meta.mainTitle}
        </h1>
        <p className="text-xl text-slate-600 font-light">
          {meta.subtitle}
        </p>
        
        <hr className="mt-12 border-t-[1.5px] border-slate-200 w-full" />
      </div>

      <style>{`
        /* Tables: Fluid width and strict word integrity */
        table {
          table-layout: auto !important;
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        th, td {
          word-break: normal !important;
          overflow-wrap: normal !important;
          hyphens: none !important;
          -webkit-hyphens: none !important;
          white-space: normal !important;
        }
        th:first-child, td:first-child {
          min-width: 150px !important;
        }

        /* Anti-Newspaper Bullet & Definition Card Lists (Single Horizontal Row Layout) */
        .definition-grid {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 16px;
          margin: 24px 0;
          width: 100%;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .definition-card {
          flex: 1 1 0%;
          min-width: 180px;
          background: #ffffff;
          border: 1px solid #edeae5;
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 4px 12px rgba(79, 60, 53, 0.04);
          display: flex;
          flex-direction: column;
          gap: 8px;
          page-break-inside: avoid;
          break-inside: avoid;
          border-top: 4px solid #3E2723;
        }
        .definition-card .def-term {
          font-size: 16px;
          font-weight: 800;
          color: #3E2723;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .definition-card .def-term::before {
          content: "🏷️";
          font-size: 14px;
        }
        .definition-card .def-body {
          font-size: 14.5px;
          line-height: 1.65;
          color: #4b5563;
        }

        .term-item {
          background: #ffffff;
          border: 1px solid #edeae5;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(79,60,53,0.03);
          display: flex;
          align-items: baseline;
          gap: 12px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .term-badge {
          background: #f5efe6;
          color: #3E2723;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 14px;
          border: 1px solid #dfd5ca;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .term-desc {
          font-size: 14.5px;
          line-height: 1.65;
          color: #374151;
        }

        .definition-spotlight {
          background: #fdfbf7;
          border: 1.5px solid #dfd5ca;
          border-left: 6px solid #3E2723;
          border-radius: 12px;
          padding: 20px 24px;
          margin: 22px 0;
          box-shadow: 0 4px 14px rgba(62,39,35,0.05);
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .spotlight-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .spotlight-icon { font-size: 20px; }
        .spotlight-title {
          font-size: 18px;
          font-weight: 900;
          color: #3E2723;
          letter-spacing: -0.2px;
        }
        .spotlight-body {
          font-size: 15.5px;
          line-height: 1.75;
          color: #374151;
        }

        .term-distinction-grid {
          display: flex;
          align-items: stretch;
          gap: 14px;
          margin: 22px 0;
        }
        .dist-col {
          flex: 1;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.03);
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .dist-tag {
          display: inline-block;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          font-weight: 800;
          font-size: 13px;
          padding: 3px 10px;
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .dist-col:last-child .dist-tag {
          background: #fdf2f8;
          color: #9d174d;
          border-color: #fbcfe8;
        }
        .dist-vs {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          color: #64748b;
          background: #f1f5f9;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          align-self: center;
        }

        .checklist-box {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 20px 0;
        }
        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1.5px solid #bbf7d0;
          border-radius: 10px;
          font-size: 15px;
          line-height: 1.65;
          color: #166534;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .check-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #16a34a;
          color: white;
          border-radius: 50%;
          font-weight: 900;
          font-size: 14px;
          margin-top: 2px;
        }
        .check-text { flex: 1; color: #14532d; }
        .check-text strong { color: #052e16; font-weight: 800; }

        .numbered-badge-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 18px;
          margin: 10px 0;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .badge-num {
          flex-shrink: 0;
          padding: 4px 12px;
          background: #0284c7;
          color: white;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        .badge-content {
          flex: 1;
          font-size: 15px;
          line-height: 1.7;
          color: #1e293b;
        }

        .colorful-notes-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin: 24px 0;
          justify-content: flex-start;
        }
        .note-card {
          padding: 18px 20px;
          border-radius: 12px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.04);
          flex: 1 1 calc(33.333% - 14px);
          min-width: 240px;
          font-size: 15px;
          line-height: 1.7;
          color: #1f2937;
          border: 1px solid rgba(0,0,0,0.06);
          box-sizing: border-box;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .note-card strong {
          font-size: 16px;
          color: #0f172a;
          font-weight: 800;
          display: block;
          margin-bottom: 6px;
        }

        .styled-bullet-list {
          list-style: none;
          padding: 0;
          margin: 20px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .styled-bullet-item {
          position: relative;
          padding: 14px 18px 14px 20px;
          background: #ffffff;
          border: 1px solid #edeae5;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          font-size: 15px;
          line-height: 1.7;
          color: #334155;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .styled-bullet-item::before {
          content: "";
          position: absolute;
          top: 14px;
          left: 0;
          width: 5px;
          height: calc(100% - 28px);
          min-height: 18px;
          background: #3E2723;
          border-radius: 0 4px 4px 0;
        }
        .styled-bullet-item > strong:first-child {
          display: inline-block;
          background: #f5efe6;
          color: #3E2723;
          padding: 2px 10px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.95em;
          margin-right: 8px;
          border: 1px solid #dfd5ca;
          letter-spacing: 0.2px;
        }

        .custom-ordered-list {
          counter-reset: card-counter;
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 1.5rem;
        }

        .custom-ordered-list > li {
          counter-increment: card-counter;
          display: flex !important;
          background: #ffffff !important;
          border-radius: 10px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.04) !important;
          overflow: hidden !important;
          border: 1px solid #edeae5 !important;
          padding: 0 !important;
          margin: 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .custom-ordered-list > li::before {
          content: "" !important;
          width: 6px !important;
          flex-shrink: 0 !important;
          display: block !important;
        }

        .custom-ordered-list > li > *:first-child {
          padding: 12px 16px;
          flex: 1;
          margin: 0;
          font-size: 15px;
          color: #5c4f45;
          line-height: 1.6;
          display: block; /* So inline ::before works */
        }

        .custom-ordered-list > li > *:first-child::before {
          content: counter(card-counter) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 32px !important;
          height: 32px !important;
          color: white !important;
          font-weight: 900 !important;
          font-size: 14px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
          margin-right: 12px !important;
          margin-left: 12px !important; /* for RTL safety */
          vertical-align: middle !important;
          margin-bottom: 10px !important;
        }

        /* Variant 1: Indigo/Blue - Soft Square */
        .custom-ordered-list > li:nth-child(4n+1)::before { background: linear-gradient(180deg, #4f46e5, #3730a3) !important; }
        .custom-ordered-list > li:nth-child(4n+1) > *:first-child::before { 
          background: linear-gradient(135deg, #4f46e5, #3730a3) !important; 
          border-radius: 8px !important;
        }

        /* Variant 2: Emerald/Green - Circle */
        .custom-ordered-list > li:nth-child(4n+2)::before { background: linear-gradient(180deg, #059669, #047857) !important; }
        .custom-ordered-list > li:nth-child(4n+2) > *:first-child::before { 
          background: linear-gradient(135deg, #059669, #047857) !important; 
          border-radius: 50% !important;
        }

        /* Variant 3: Amber/Orange - Leaf Shape */
        .custom-ordered-list > li:nth-child(4n+3)::before { background: linear-gradient(180deg, #ea580c, #c2410c) !important; }
        .custom-ordered-list > li:nth-child(4n+3) > *:first-child::before { 
          background: linear-gradient(135deg, #ea580c, #c2410c) !important; 
          border-radius: 12px 4px 12px 4px !important;
        }

        /* Variant 4: Rose/Pink - Reverse Leaf Shape */
        .custom-ordered-list > li:nth-child(4n+4)::before { background: linear-gradient(180deg, #e11d48, #be123c) !important; }
        .custom-ordered-list > li:nth-child(4n+4) > *:first-child::before { 
          background: linear-gradient(135deg, #e11d48, #be123c) !important; 
          border-radius: 4px 12px 4px 12px !important;
        }
        
        .custom-ordered-list > li > *:first-child > strong:first-child {
          font-weight: 800 !important;
          font-size: 16px !important;
          color: #3E2723 !important;
          font-family: 'Inter', sans-serif !important;
          margin-bottom: 10px;
          display: inline-block;
          vertical-align: middle;
        }
        
        /* Force line break after the bold title to mimic the card header vs content separation */
        .custom-ordered-list > li > *:first-child > strong:first-child::after {
          content: "\\A";
          white-space: pre;
        }

        /* Highlight styles override */
        .custom-ordered-list > li p code,
        .custom-ordered-list > li mark {
          background-color: var(--highlight-bg) !important;
          color: var(--highlight-text) !important;
          padding: 0.2rem 0.6rem !important;
          border-radius: 9999px !important;
          font-weight: 800 !important;
          font-size: 0.9em !important;
          border: none !important;
        }

        /* 1. Developmental Assessment Cards */
        .dev-assessment-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .dev-assessment-cards .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border-top: 4px solid #6b7280;
          display: flex;
          flex-direction: column;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .dev-assessment-cards .card-tag {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-block;
          width: max-content;
          margin-bottom: 16px;
        }
        .dev-assessment-cards .card-red { border-top-color: #ef4444; }
        .dev-assessment-cards .card-red .card-tag { background: #fee2e2; color: #991b1b; }
        .dev-assessment-cards .card-red .card-action { background: #ef4444; color: white; }
        .dev-assessment-cards .card-orange { border-top-color: #f59e0b; }
        .dev-assessment-cards .card-orange .card-tag { background: #fef3c7; color: #b45309; }
        .dev-assessment-cards .card-orange .card-action { background: #f59e0b; color: white; }
        .dev-assessment-cards .card-green { border-top-color: #10b981; }
        .dev-assessment-cards .card-green .card-tag { background: #d1fae5; color: #065f46; }
        .dev-assessment-cards .card-green .card-action { background: #10b981; color: white; }
        .dev-assessment-cards .card-content {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 24px;
          flex-grow: 1;
          border-bottom: 1px dashed #e5e7eb;
          padding-bottom: 16px;
        }
        .dev-assessment-cards .card-title {
          font-weight: 800;
          font-size: 18px;
          color: #111827;
          margin-bottom: 16px;
          text-align: center;
        }
        .dev-assessment-cards .card-action {
          font-weight: 700;
          font-size: 14px;
          text-align: center;
          padding: 12px;
          border-radius: 6px;
        }

        /* 2. Wellbeing Timeline */
        .wellbeing-timeline {
          margin: 40px 0;
          padding: 30px;
          background: #fdfbf7;
          border-radius: 16px;
          border: 1px solid #edeae5;
          overflow-x: auto;
        }
        .wellbeing-timeline .timeline-nodes {
          display: flex;
          align-items: flex-start;
          min-width: max-content;
          gap: 15px;
        }
        .wellbeing-timeline .node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          min-width: 80px;
        }
        .wellbeing-timeline .circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #3e2723;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          z-index: 2;
        }
        .wellbeing-timeline .circle.border {
          background: white;
          color: #3e2723;
          border: 3px solid #3e2723;
        }
        .wellbeing-timeline span {
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          text-align: center;
        }
        .wellbeing-timeline .line {
          flex-grow: 1;
          min-width: 40px;
          height: 2px;
          background: #d1d5db;
          margin-top: 27px;
        }

        /* 3. Nurturing Care Grid */
        .nurturing-care-grid {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          gap: 12px;
          margin: 30px 0;
          padding-bottom: 8px; /* Prevent scrollbar from overlapping */
        }
        .nurturing-care-grid .grid-item {
          flex: 1;
          min-width: 90px;
          background: #fffdf7;
          border: 1px solid #edeae5;
          border-radius: 12px;
          padding: 16px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
          transition: transform 0.2s;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .nurturing-care-grid .grid-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0,0,0,0.05);
        }
        .nurturing-care-grid .icon {
          font-size: 28px;
          line-height: 1;
        }
        .nurturing-care-grid .title {
          font-weight: 800;
          font-size: 13px;
          color: #3e2723;
          text-align: center;
        }
        /* 4. Colorful Notes Grid */
        .colorful-notes-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin: 24px 0;
          justify-content: center;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .colorful-notes-grid .note-card {
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          flex: 1 1 calc(33.333% - 16px);
          min-width: 250px;
          font-size: 15px;
          line-height: 1.8;
          color: #1f2937;
          border: 1px solid rgba(0,0,0,0.05);
          break-inside: avoid;
          page-break-inside: avoid;
        }
        /* Color variants */
        .colorful-notes-grid .note-card:nth-child(5n+1) { background-color: #fefce8; border-color: #fef08a; } /* Yellow */
        .colorful-notes-grid .note-card:nth-child(5n+2) { background-color: #f0fdf4; border-color: #bbf7d0; } /* Green */
        .colorful-notes-grid .note-card:nth-child(5n+3) { background-color: #eff6ff; border-color: #bfdbfe; } /* Blue */
        .colorful-notes-grid .note-card:nth-child(5n+4) { background-color: #fdf2f8; border-color: #fbcfe8; } /* Pink */
        .colorful-notes-grid .note-card:nth-child(5n+5) { background-color: #fff7ed; border-color: #fed7aa; } /* Orange */

        /* 5. Info Note (Purple Block) */
        .info-note {
          background-color: #EBEBFF;
          border-left: 5px solid #5C4CD7;
          border-radius: 8px;
          padding: 16px 20px;
          margin: 24px 0;
          color: #33334d;
          font-size: 15.5px;
          line-height: 1.6;
        }
        .info-note strong {
          color: #352A85;
          font-weight: 800;
          margin-right: 6px;
        }

        /* Lined Notebook Note Sheet (Lined Paper & Big 24px/20px/19px Typography) */
        .handwritten-notebook-note {
          background: #ffffff !important;
          background-image: linear-gradient(90deg, rgba(239, 68, 68, 0.45) 1.5px, transparent 1.5px), repeating-linear-gradient(transparent, transparent 31px, #e2e8f0 31px, #e2e8f0 32px) !important;
          background-size: 100% 100%, 100% 32px !important;
          background-position: 48px 0, 0 0 !important;
          padding: 24px 30px 30px 60px !important;
          border: 1.5px solid #cbd5e1 !important;
          border-radius: 12px !important;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06) !important;
          margin: 28px 0 !important;
          font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important;
          font-size: 19px !important;
          line-height: 1.8 !important;
          color: #0f172a !important;
          direction: ltr !important;
          position: relative !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .handwritten-notebook-note h2,
        .handwritten-notebook-note .note-title {
          font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important;
          font-size: 24px !important;
          font-weight: 900 !important;
          color: #1e40af !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          display: inline-block !important;
          border-bottom: 3px double #1e40af !important;
          padding-bottom: 4px !important;
          margin: 0 0 16px 0 !important;
        }

        .handwritten-notebook-note span,
        .handwritten-notebook-note .pill,
        .handwritten-notebook-note .pill-header {
          font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          color: #0f172a !important;
          padding: 4px 16px !important;
          border-radius: 6px !important;
          display: inline-block !important;
          letter-spacing: 0.5px !important;
          margin: 8px 0 6px 0 !important;
        }

        .handwritten-notebook-note .pill-contraindication,
        .handwritten-notebook-note .contraindication-badge {
          background-color: #bbf7d0 !important;
          color: #166534 !important;
          border: 1.5px solid #86efac !important;
        }

        .handwritten-notebook-note ul,
        .handwritten-notebook-note ol,
        .handwritten-notebook-note li,
        .handwritten-notebook-note p,
        .handwritten-notebook-note div {
          font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important;
          font-size: 19px !important;
          line-height: 1.8 !important;
          color: #0f172a !important;
        }

        .handwritten-notebook-note strong {
          font-size: 19px !important;
          font-weight: 900 !important;
          color: #0f172a !important;
        }

        .handwritten-notebook-note .katex {
          font-size: 1.15em !important;
        }

        .clinical-pearls-box {
          background-color: #f0fdf4 !important;
          border: 1.5px solid #a7f3d0 !important;
          border-radius: 16px !important;
          padding: 22px 24px !important;
          margin: 24px 0 !important;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.05) !important;
          text-align: left !important;
          direction: ltr !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .clinical-pearls-box h3 {
          color: #065f46 !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          margin: 0 0 16px 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .clinical-pearls-box strong {
          color: #064e3b !important;
          font-weight: 800 !important;
        }

        /* 6. Reaction Pathway & Enzymatic Mechanism Diagram (Multi-Tier Mechanism Card) */
        .reaction-pathway-diagram,
        .enzymatic-mechanism-diagram {
          background: #ffffff !important;
          border: 1.5px solid #edeae5 !important;
          border-radius: 20px !important;
          padding: 28px 24px !important;
          margin: 30px 0 !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.03) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
          width: 100% !important;
          box-sizing: border-box !important;
          direction: ltr !important;
          text-align: left !important;
        }

        .reaction-pathway-diagram h3,
        .enzymatic-mechanism-diagram h3 {
          text-align: center !important;
          color: #1e293b !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          margin: 0 0 22px 0 !important;
          letter-spacing: -0.2px !important;
        }

        @media print {
          .dev-assessment-cards {
            display: flex !important;
            flex-wrap: wrap !important;
          }
          .dev-assessment-cards .card {
            width: calc(50% - 10px) !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: inline-flex !important;
          }
          .colorful-notes-grid {
            display: block !important;
            margin: 10px 0 !important;
          }
          .colorful-notes-grid .note-card {
            display: inline-block !important;
            width: calc(25% - 10px) !important;
            margin: 5px !important;
            padding: 12px !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
            min-width: 0 !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            vertical-align: top !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            flex: none !important;
          }

          .handwritten-notebook-note,
          .reaction-pathway-diagram,
          .enzymatic-mechanism-diagram {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="max-w-none text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h2: ({ node, ...props }) => (
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-14 mb-6 border-b-[1.5px] border-slate-200 pb-4 flex items-center gap-3" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="font-serif text-xl font-bold text-slate-800 mt-10 mb-4" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="leading-relaxed mb-4 text-slate-700" {...props} />
            ),
            ul: ({ node, className, ...props }: any) => {
              if (className?.includes('options') || className?.includes('timeline-nodes')) {
                return <ul className={className} {...props} />;
              }
              return <ul className={`styled-bullet-list ${className || ''}`} {...props} />;
            },
            ol: ({ node, className, ...props }: any) => {
              if (className?.includes('custom-ordered-list')) {
                return <ol className={className} {...props} />;
              }
              return <ol className={`list-decimal pl-6 space-y-2 mb-6 text-slate-700 ${className || ''}`} {...props} />;
            },
            li: ({ node, className, ...props }: any) => (
              <li className={`styled-bullet-item ${className || ''}`} {...props} />
            ),
            blockquote: ({ node, ...props }) => (
              <div className="bg-[#FAFAFA] border-l-[5px] border-[#3E2723] border-y border-r border-[#EEEEEE] p-5 rounded-r-md my-6 shadow-sm">
                <blockquote className="m-0 text-slate-700 text-[15px] leading-relaxed" {...props} />
              </div>
            ),
            table: ({ node, ...props }) => (
              <div className="my-10 w-full overflow-hidden rounded-[12px] shadow-[0_4px_16px_rgba(79,60,53,0.1)] border border-[#D7CCC8] bg-white break-inside-avoid print:shadow-none print:border-[#D7CCC8]">
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse table-auto" {...props} />
                </div>
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-[#4F3C35]" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="p-4 sm:p-[18px] text-[15px] font-black tracking-[0.5px] text-white border border-[#D7CCC8] align-top whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] [hyphens:none] min-w-[140px]" {...props} />
            ),
            tbody: ({ node, ...props }) => (
              <tbody {...props} />
            ),
            tr: ({ node, ...props }) => (
              <tr className="bg-white transition-colors hover:bg-[#FDFBF7]" {...props} />
            ),
            td: ({ node, isHeader, ...props }: any) => (
              <td className="p-4 sm:p-[18px] text-[15px] font-medium leading-[1.6] border border-[#D7CCC8] align-top text-slate-800 whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] [hyphens:none] first:bg-[#E3D8D5] first:text-[#3E2723] first:font-bold first:min-w-[140px]" {...props} />
            ),
            code: ({ node, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !className?.includes('block');
              return isInline ? (
                <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-bold text-[0.9em] whitespace-nowrap" {...props}>
                  {children}
                </code>
              ) : (
                <pre className="bg-slate-800 text-slate-50 p-4 rounded-lg overflow-x-auto mb-6">
                  <code className={className} {...props}>{children}</code>
                </pre>
              );
            },
            strong: ({ node, ...props }) => (
              <strong className="font-semibold text-slate-900" {...props} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
