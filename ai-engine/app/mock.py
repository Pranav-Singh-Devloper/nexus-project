"""Mock mode (AI_MOCK=1): canned, instant responses with no API keys.

Used by tests, CI, `docker compose`, and local UI work so they never spend
free-tier quota. Outputs have the same shape as the real endpoints.
"""
import hashlib
import math
import os
import random
from urllib.parse import quote


def enabled() -> bool:
    return os.getenv("AI_MOCK", "").lower() in {"1", "true", "yes"}


def report(prompt: str) -> str:
    topic = " ".join(prompt.split()) or "the market"
    return f"""## {topic}

> Mock report (AI_MOCK=1). No API keys were used.

### Market overview
- The market for **{topic}** is growing steadily, with an estimated **12% CAGR** through 2030.
- Demand is driven by digital adoption, falling costs and supportive regulation.

### Key players
| Company | Focus | Notable move |
|---|---|---|
| Alpha Corp | Enterprise | Raised a Series C in 2026 |
| Beta Labs | SMB | Launched a freemium tier |
| Gamma Inc | Consumer | Expanded to India |

### Trends to watch
1. Consolidation among mid-sized players.
2. AI-assisted workflows becoming table stakes.
3. Pricing moving from seats to usage.

### Sources
- [Example Research - Market outlook 2026](https://example.com/market-outlook)
- [Example News - Funding round coverage](https://example.com/funding)
"""


def post(content: str) -> dict:
    first_line = next((l.strip("# ").strip() for l in content.splitlines() if l.strip()), "this market")
    return {
        "status": "success",
        "post_html": (
            f"<p>🚀 <b>{first_line}</b> is moving faster than most people think.</p>"
            "<p>Three things stood out in my research:</p>"
            "<ul><li>Growth is steady at around 12% a year</li>"
            "<li>Pricing is shifting from seats to usage</li>"
            "<li>AI features are becoming the default</li></ul>"
            "<p>What are you seeing in your corner of the market? 👇</p>"
        ),
        "hashtags": ["#MarketResearch", "#Startups", "#AI"],
        "image_prompt": f"Clean editorial illustration about {first_line}, navy and coral palette, soft light",
        "image_style": "square",
    }


def image(prompt: str) -> dict:
    label = (prompt[:40] + "…") if len(prompt) > 40 else prompt
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'>"
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
        "<stop offset='0' stop-color='#14213D'/><stop offset='1' stop-color='#FF6B5B'/></linearGradient></defs>"
        "<rect width='800' height='800' fill='url(#g)'/>"
        "<text x='50%' y='50%' fill='#F4EDE0' font-family='sans-serif' font-size='36' text-anchor='middle'>Mock image</text>"
        f"<text x='50%' y='57%' fill='#F4EDE0' opacity='.7' font-family='sans-serif' font-size='20' text-anchor='middle'>{_xml(label)}</text>"
        "</svg>"
    )
    return {"status": "success", "image_url": "data:image/svg+xml;utf8," + quote(svg)}


def vector(text: str, dim: int = 384) -> list[float]:
    """Deterministic unit vector: same text → same vector, so search tests are stable."""
    seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    v = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


def _xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&apos;")
