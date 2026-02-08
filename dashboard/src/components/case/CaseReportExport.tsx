'use client';

import { useState, useRef } from 'react';
import {
  Download,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TreatmentOption {
  name: string;
  verdict: string;
  confidence: number;
  evidence_grade: string;
  rationale: string;
  key_evidence: Array<{ finding: string; pmid?: string }>;
}

interface CaseReportData {
  parsedCase: {
    patient?: { age: string; sex: string; relevant_history: string[] };
    findings?: { presentation: string; labs: string[]; imaging: string[] };
    clinical_question: string;
    case_category: string;
  };
  topRecommendation: string;
  recommendationRationale: string;
  treatmentOptions: TreatmentOption[];
  acuteManagement?: {
    risk_stratification?: string;
    immediate_actions?: string[];
    monitoring_plan?: string[];
    disposition?: string;
  };
  clinicalPearls: string[];
  papersReviewed: Array<{ pmid: string; title: string; year?: string }>;
}

interface CaseReportExportProps {
  data: CaseReportData;
}

export function CaseReportExport({ data }: CaseReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      // Build report HTML
      const reportDiv = document.createElement('div');
      reportDiv.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;padding:40px;background:white;color:#111;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;';

      const recommended = data.treatmentOptions.filter(t => t.verdict === 'recommended');
      const consider = data.treatmentOptions.filter(t => t.verdict === 'consider');

      reportDiv.innerHTML = `
        <div style="border-bottom:3px solid #0d9488;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;color:#0d9488;margin:0 0 4px 0;">MedLit Agent — Clinical Case Report</h1>
          <p style="color:#666;font-size:11px;margin:0;">Generated ${new Date().toLocaleString()} | For educational purposes only</p>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:15px;font-weight:600;color:#0d9488;margin:0 0 8px 0;">Patient Summary</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:120px;">Patient</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;">${data.parsedCase.patient?.age || '—'} ${data.parsedCase.patient?.sex || ''}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Category</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;">${data.parsedCase.case_category || '—'}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Question</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;">${data.parsedCase.clinical_question || '—'}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom:20px;padding:12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;">
          <h2 style="font-size:15px;font-weight:600;color:#0d9488;margin:0 0 4px 0;">Top Recommendation</h2>
          <p style="font-size:14px;font-weight:600;margin:0 0 4px 0;">${data.topRecommendation}</p>
          <p style="color:#555;margin:0;font-size:11px;">${data.recommendationRationale}</p>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:15px;font-weight:600;color:#0d9488;margin:0 0 8px 0;">Treatment Comparison</h2>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#f9fafb;">
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left;">Treatment</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">Verdict</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">Confidence</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">Evidence</th>
            </tr>
            ${data.treatmentOptions.map(t => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:500;">${t.name}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
                  <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;${
                    t.verdict === 'recommended' ? 'background:#dcfce7;color:#166534;' :
                    t.verdict === 'consider' ? 'background:#fef9c3;color:#854d0e;' :
                    'background:#fee2e2;color:#991b1b;'
                  }">${t.verdict.replace('_', ' ').toUpperCase()}</span>
                </td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:600;">${Math.round(t.confidence * 100)}%</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">${(t.evidence_grade || '').toUpperCase()}</td>
              </tr>
            `).join('')}
          </table>
        </div>

        ${data.acuteManagement?.immediate_actions?.length ? `
        <div style="margin-bottom:20px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">
          <h2 style="font-size:15px;font-weight:600;color:#c2410c;margin:0 0 8px 0;">Acute Management Protocol</h2>
          ${data.acuteManagement.risk_stratification ? `<p style="font-weight:600;margin:0 0 8px 0;">Risk: ${data.acuteManagement.risk_stratification}</p>` : ''}
          <ol style="margin:0;padding-left:20px;">
            ${data.acuteManagement.immediate_actions.map(a => `<li style="margin-bottom:4px;">${a}</li>`).join('')}
          </ol>
          ${data.acuteManagement.disposition ? `<p style="margin:8px 0 0 0;"><strong>Disposition:</strong> ${data.acuteManagement.disposition}</p>` : ''}
        </div>
        ` : ''}

        ${data.clinicalPearls.length > 0 ? `
        <div style="margin-bottom:20px;">
          <h2 style="font-size:15px;font-weight:600;color:#0d9488;margin:0 0 8px 0;">Clinical Pearls</h2>
          <ul style="margin:0;padding-left:20px;">
            ${data.clinicalPearls.map(p => `<li style="margin-bottom:4px;">${p}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div style="margin-bottom:20px;">
          <h2 style="font-size:15px;font-weight:600;color:#0d9488;margin:0 0 8px 0;">Evidence Citations (${data.papersReviewed.length} papers)</h2>
          <ol style="margin:0;padding-left:20px;font-size:11px;color:#555;">
            ${data.papersReviewed.slice(0, 10).map(p => `
              <li style="margin-bottom:4px;">${p.title}${p.year ? ` (${p.year})` : ''}${p.pmid ? ` — PMID: ${p.pmid}` : ''}</li>
            `).join('')}
          </ol>
        </div>

        <div style="border-top:1px solid #e5e7eb;padding-top:12px;color:#999;font-size:10px;">
          <p style="margin:0;">Disclaimer: This report is generated by MedLit Agent for educational purposes only. It does not constitute medical advice. Clinical decisions should be made by qualified healthcare professionals based on individual patient assessment.</p>
          <p style="margin:4px 0 0 0;">Powered by MedGemma 1.5 | Evidence from PubMed | Report ID: ${Date.now().toString(36)}</p>
        </div>
      `;

      document.body.appendChild(reportDiv);

      const canvas = await html2canvas(reportDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(reportDiv);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Handle multi-page
      let heightLeft = imgHeight;
      let position = 0;
      const pageHeight = 297; // A4 height in mm

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `medlit-report-${data.parsedCase.case_category || 'case'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportPDF}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {isExporting ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
}
