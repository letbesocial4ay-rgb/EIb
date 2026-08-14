"""Write three concrete high-confidence errors for the public methodology page."""
from pathlib import Path
import json, sys
sys.path.insert(0, str(Path(__file__).parents[1]))
from server import run_analysis, Options

def main():
    rows=json.loads((Path(__file__).parents[1]/"data/processed/corpus.json").read_text()); cases=[]
    for row in rows:
        r=run_analysis(row["text"], Options()); score=r["document_summary"]["overall_score"]; actual=0 if row["quadrant"].startswith("human") else 1
        distance=abs(score-actual)
        cases.append((distance,row,score))
    lines=["# Three confidently wrong cases",""]
    for i,(_,row,score) in enumerate(sorted(cases, key=lambda item: item[0], reverse=True)[:3],1):
        lines += [f"## Case {i}: {row['id']}",f"- True quadrant: {row['quadrant']}",f"- Detector score: {score:.3f}","- Hypothesis: Repeated narrative structure and predictable vocabulary can look like model compression even when a human wrote the passage; short samples amplify that effect.",""]
    (Path(__file__).parents[1]/"data/processed/error_analysis.md").write_text("\n".join(lines))
if __name__ == "__main__": main()