"""Builds the small, transparent EAIA benchmark corpus used in this environment."""
from pathlib import Path
import json

ROOT = Path(__file__).parent
ROOT.joinpath("processed").mkdir(parents=True, exist_ok=True)
human = ["I learned to repair bicycles with my neighbor after my chain broke on a rainy afternoon. The work was slow, but every small adjustment taught me to listen carefully and try again. I still remember the grease on my hands and the quiet satisfaction of a wheel turning smoothly."]
esl = ["Firstly, I want to explain my experience in the library. In conclusion, this opportunity gave me many benefits and I learned that teamwork is important. I sometimes choose simple words, but I pay attention to people and keep improving my communication."]
synthetic = ["In today's fast-paced world, my transformative journey became a profound testament to resilience. This experience empowered me to navigate the intricate complexities of leadership and emerge as a catalyst for meaningful change."]
hybrid = ["I grew up translating forms for my family. This journey of self-discovery taught me patience. Moreover, I began to see each conversation as an opportunity to build bridges and pursue a brighter future."]
rows=[]
for label, samples in [("human_native",human),("human_esl",esl),("pure_synthetic",synthetic),("hybrid_polished",hybrid)]:
    for i in range(4): rows.append({"id":f"{label}-{i}","quadrant":label,"text":samples[0] + " " + samples[0]})
ROOT.joinpath("processed", "corpus.json").write_text(json.dumps(rows, indent=2))
print(f"wrote {len(rows)} essays to {ROOT/'processed/corpus.json'}")