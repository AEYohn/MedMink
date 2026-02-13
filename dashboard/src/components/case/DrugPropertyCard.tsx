'use client';

import { useState } from 'react';
import { Pill, Loader2, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DrugPropertyCardProps {
  drugName?: string;
}

interface ToxicityProfile {
  drug: string;
  hepatotoxicity_risk: string;
  nephrotoxicity_risk: string;
  cardiotoxicity_risk: string;
  neurotoxicity_risk: string;
  hematologic_toxicity_risk: string;
  bbb_penetration: string;
  therapeutic_index: string;
  key_toxicities: string[];
  monitoring_required: string[];
}

interface DrugProperties {
  drug: string;
  drug_class: string;
  mechanism_of_action: string;
  primary_targets: string[];
  half_life: string;
  metabolism: string;
  protein_binding: string;
  special_populations?: {
    pregnancy_category: string;
    renal_adjustment: string;
    hepatic_adjustment: string;
    elderly_considerations: string;
  };
}

export function DrugPropertyCard({ drugName }: DrugPropertyCardProps) {
  const [drug, setDrug] = useState(drugName || '');
  const [toxicity, setToxicity] = useState<ToxicityProfile | null>(null);
  const [properties, setProperties] = useState<DrugProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    if (!drug.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const [toxRes, propRes] = await Promise.all([
        fetch(`${API_URL}/api/case/drug-toxicity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drug: drug.trim() }),
        }),
        fetch(`${API_URL}/api/case/drug-properties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drug: drug.trim() }),
        }),
      ]);

      if (toxRes.ok) setToxicity(await toxRes.json());
      if (propRes.ok) setProperties(await propRes.json());

      if (!toxRes.ok && !propRes.ok) throw new Error('Both lookups failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const riskBadge = (level: string) => {
    const color = level === 'high' ? 'destructive' : level === 'moderate' ? 'secondary' : 'outline';
    return <Badge variant={color as 'destructive' | 'secondary' | 'outline'} className="text-xs">{level}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Pill className="w-4 h-4 text-purple-500" />
          Drug Properties — TxGemma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="Enter drug name..."
            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background"
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <button
            onClick={lookup}
            disabled={loading || !drug.trim()}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Properties */}
        {properties && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Pharmacology</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Class:</span>{' '}
                <span className="font-medium">{properties.drug_class}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Half-life:</span>{' '}
                <span className="font-medium">{properties.half_life}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Mechanism:</span>{' '}
                <span>{properties.mechanism_of_action}</span>
              </div>
              {properties.special_populations && (
                <>
                  <div>
                    <span className="text-muted-foreground">Pregnancy:</span>{' '}
                    {properties.special_populations.pregnancy_category}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Renal adj:</span>{' '}
                    {properties.special_populations.renal_adjustment}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Toxicity */}
        {toxicity && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Toxicity Profile
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Hepatotoxicity</span>
                {riskBadge(toxicity.hepatotoxicity_risk)}
              </div>
              <div className="flex items-center justify-between">
                <span>Nephrotoxicity</span>
                {riskBadge(toxicity.nephrotoxicity_risk)}
              </div>
              <div className="flex items-center justify-between">
                <span>Cardiotoxicity</span>
                {riskBadge(toxicity.cardiotoxicity_risk)}
              </div>
              <div className="flex items-center justify-between">
                <span>Neurotoxicity</span>
                {riskBadge(toxicity.neurotoxicity_risk)}
              </div>
              <div className="flex items-center justify-between">
                <span>BBB Penetration</span>
                <Badge variant="outline" className="text-xs">{toxicity.bbb_penetration}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Therapeutic Index</span>
                <Badge variant="outline" className="text-xs">{toxicity.therapeutic_index}</Badge>
              </div>
            </div>

            {toxicity.monitoring_required.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Monitoring:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {toxicity.monitoring_required.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
