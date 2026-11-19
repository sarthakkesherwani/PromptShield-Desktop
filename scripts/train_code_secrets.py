"""Train a small local classifier for credential assignments using generated examples."""
import json
import math
import random
from pathlib import Path

rng = random.Random(47)
examples = []
def features(name, value):
    words = name.lower().split('_')
    return [int(bool(set(words) & {'api','access','auth','client','private','signing','service','deployment','secret'})),
            int(bool(set(words) & {'key','token','secret','credential','password'})),
            int(len(value) >= 12), int(len(value) >= 20), int(any(c.isdigit() for c in value)),
            int(any(c.isupper() for c in value) and any(c.islower() for c in value))]
for _ in range(240):
    value = ''.join(rng.choices('abcdefghijkmnopqrsABCDEFGHJKLMNPQRS1234567890_-', k=rng.randint(12,50)))
    for name in ['service_token','client_secret','deployment_credential','signing_key','vendor_api_key']:
        examples.append((features(name,value),1))
        examples.append((features(name,rng.choice(['enabled','example','unset','default'])),0))
    for name in ['build_hash','release_id','asset_version','keyboard_layout','service_name','access_mode']:
        examples.append((features(name,value),0))
weights = [0.] * 6
bias = 0.
for epoch in range(35):
    rng.shuffle(examples)
    for x,y in examples:
        p = 1 / (1 + math.exp(-(bias + sum(a*b for a,b in zip(weights,x)))))
        delta = .035 * (y-p)
        bias += delta
        weights = [w + delta*v for w,v in zip(weights,x)]
path = Path(__file__).resolve().parents[1] / 'detector/code-secret-weights.json'
path.write_text(json.dumps(dict(weights=weights,bias=bias,trainingExamples=len(examples)))+'\n')
