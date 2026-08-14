"""Run a real benchmark over data/processed/corpus.json and write markdown metrics."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
from server import run_analysis, Options

def main():
    from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
    rows=json.loads((Path(__file__).parents[1]/"data/processed/corpus.json").read_text())
    y=[]; pred=[]; scores=[]; quadrants={}
    for row in rows:
        result=run_analysis(row["text"], Options())
        score=result["document_summary"]["overall_score"]; actual=0 if row["quadrant"].startswith("human") else 1
        y.append(actual); pred.append(int(score>=.42)); scores.append(score); quadrants.setdefault(row["quadrant"],[]).append((actual,pred[-1]))
    lines=["# EAIA-1.0 benchmark report",f"Held-out samples: {len(rows)}",f"Precision: {precision_score(y,pred,zero_division=0):.3f}",f"Recall: {recall_score(y,pred,zero_division=0):.3f}",f"F1: {f1_score(y,pred,zero_division=0):.3f}",f"ROC-AUC: {roc_auc_score(y,scores):.3f}"]
    for q, vals in quadrants.items():
        if q.startswith("human"): lines.append(f"{q} FPR: {sum(p for a,p in vals)/len(vals):.3f}")
        else: lines.append(f"{q} TPR: {sum(p for a,p in vals)/len(vals):.3f}")
    native=sum(p for a,p in quadrants["human_native"])/4; esl=sum(p for a,p in quadrants["human_esl"])/4
    lines.append(f"ESL/native FPR gap: {abs(esl-native):.3f} (low confidence; n=4 per group)")
    out=Path(__file__).parents[1]/"data/processed/benchmark_report.md"; out.write_text("\n".join(lines)+"\n"); print(out)
if __name__ == "__main__": main()