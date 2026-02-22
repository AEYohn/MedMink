# Recording Checklist

## Before Recording

### 1. Start Backend
```bash
# Option A: Local FastAPI
cd /Users/noam1/research-synthesizer
.venv/bin/python -m uvicorn src.api.main:app --port 8001 --reload

# Option B: Modal backend
.venv/bin/python modal_backend.py
```

### 2. Start Frontend
```bash
cd /Users/noam1/research-synthesizer/dashboard
npm run dev
# Opens at http://localhost:3000
```

### 3. Prepare Eclampsia Case Text
Copy from: `demo/eclampsia_case.txt`

Or paste directly:
```
A 32-year-old G2P1 female at 34 weeks gestation is brought to the ED after a witnessed generalized tonic-clonic seizure at home lasting approximately 90 seconds. She has no prior seizure history. Her pregnancy has been complicated by gestational hypertension diagnosed at 28 weeks. She reports severe headache and visual changes ('seeing spots') for the past 6 hours. Vitals: BP 185/110, HR 108, RR 20, T 37.3°C, SpO2 96% on RA. Exam: postictal but responsive, 3+ bilateral lower extremity edema, hyperreflexia with clonus (3 beats), RUQ tenderness. Fetal heart rate 140 with minimal variability. Labs: platelet count 88,000, AST 245, ALT 198, LDH 620, Cr 1.3, uric acid 7.8, proteinuria 4+ on dipstick, protein/creatinine ratio 5.2. Peripheral smear: schistocytes present.
```

### 4. Pre-type Eval Command
In a terminal window, have this ready:
```bash
cd /Users/noam1/research-synthesizer
.venv/bin/python -m src.evaluation.run_eval
```

### 5. Run Unit Tests (verify before recording)
```bash
.venv/bin/python -m pytest tests/unit/test_scorer.py -p no:recording -v
# Expected: 93 passed
```

### 6. Browser Setup
- [ ] Zoom to 90% (`Cmd+Minus` once from 100%)
- [ ] Hide bookmarks bar (`Cmd+Shift+B`)
- [ ] Close personal tabs
- [ ] Dark mode OFF (Settings > light theme)

### 7. Pre-load Pages
- [ ] Visit `/interview` — send a few test messages so it's not empty
- [ ] Visit `/chart` — load the example or create a SOAP note with compliance badge
- [ ] Visit `/` — verify stat cards and quick actions visible

## Verified Numbers

| Claim | Actual | Status |
|-------|--------|--------|
| 7 AI models | MedGemma + CXR + Derm + Path + TxGemma + HeAR + MedASR | Verified |
| 19 checks | 19 checks in scorer.py | Verified |
| 13 cases | 13 test cases in test_cases.py | Verified |
| 93 unit tests | 93 tests in test_scorer.py (all passing) | Verified |
| 16 specialties | 16 categories in MEDICAL_CATEGORIES | Verified |
| 10 compliance rules | 10 deterministic rules in compliance_engine.py | Verified |
| 3-layer med safety | Deterministic + TxGemma + MedGemma | Verified |
| 4.6% WER | MedASR spec from deployment | Verified |
