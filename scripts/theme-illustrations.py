"""Generates the illustrations of the world themes shipped with BuilderZ
(src/features/world-theme/illustrations). They were drawn for BuilderZ,
never taken from vvd (ADR 0003).

Each is a 1600x1000 landscape with its subject near the center, so a
portrait crop (gallery card) keeps it. Deterministic (fixed seeds): running
it again gives the same files. Usage: python scripts/theme-illustrations.py
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "features", "world-theme", "illustrations")
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 1000


def ridge(seed, base, amp, step=40, rough=0.5, left=0, right=W):
    """Polygon points of a mountain/hill ridge closed at the bottom."""
    rnd = random.Random(seed)
    pts = []
    y = base
    x = left
    phase = rnd.random() * 6.28
    while x <= right + step:
        y = base - amp * (0.5 + 0.5 * math.sin(x / 260 + phase)) - rnd.uniform(-amp, amp) * rough * 0.4
        pts.append((x, y))
        x += step
    pts += [(right + step, H), (left, H)]
    return " ".join(f"{px:.0f},{py:.0f}" for px, py in pts)


def peaks(seed, base, heights, xs, width):
    """Sharp mountain range through given peak positions."""
    rnd = random.Random(seed)
    pts = [(-50, base)]
    for x, h in zip(xs, heights):
        pts.append((x - width * rnd.uniform(0.8, 1.2), base - h * 0.35))
        pts.append((x, base - h))
        pts.append((x + width * rnd.uniform(0.8, 1.2), base - h * 0.4))
    pts += [(W + 50, base), (W + 50, H), (-50, H)]
    return " ".join(f"{px:.0f},{py:.0f}" for px, py in pts)


TITLES = {
    "dawn": "Golden dawn",
    "forest": "Old forest",
    "sea": "High sea",
    "embers": "Embers",
    "night": "Starry night",
    "peaks": "Frozen peaks",
    "dunes": "Dunes",
    "blossom": "Blossom",
}


def svg(name, defs, body):
    content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<title>{TITLES[name]}</title>
<defs>{defs}</defs>
{body}
</svg>
"""
    open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8", newline="\n").write(content)


def stars(seed, n, ymax, rmax=2.2, opacity=0.9):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, ymax) ** 1.0
        r = rnd.uniform(0.6, rmax)
        o = rnd.uniform(0.35, opacity)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#fff" opacity="{o:.2f}"/>')
    return "".join(out)


def pines(seed, n, base, hmin, hmax, color, x0=0, x1=W):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x = rnd.uniform(x0, x1)
        h = rnd.uniform(hmin, hmax)
        w = h * rnd.uniform(0.22, 0.3)
        y = base + rnd.uniform(-10, 25)
        out.append(f'<polygon points="{x:.0f},{y - h:.0f} {x - w:.0f},{y:.0f} {x + w:.0f},{y:.0f}" fill="{color}"/>')
    return "".join(out)


# 1. Dawn: warm sky, low sun, layered ochre hills.
svg(
    "dawn",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#3b2a52"/><stop offset="0.45" stop-color="#c2604a"/><stop offset="0.75" stop-color="#f1a55a"/><stop offset="1" stop-color="#f7d58a"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4cf"/><stop offset="0.5" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="800" cy="610" r="260" fill="url(#sun)"/>
<circle cx="800" cy="610" r="70" fill="#fff1c4"/>
<polygon points="{ridge(1, 640, 120, rough=0.6)}" fill="#b0603f" opacity="0.75"/>
<polygon points="{ridge(2, 720, 110)}" fill="#8a4532"/>
<polygon points="{ridge(3, 820, 90)}" fill="#5f2f2a"/>
<polygon points="{ridge(4, 920, 70)}" fill="#3a1f22"/>""",
)

# 2. Old forest: misty greens and pines.
svg(
    "forest",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0f2a24"/><stop offset="0.5" stop-color="#2f5b47"/><stop offset="1" stop-color="#9cc3a0"/></linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9efd8" stop-opacity="0"/><stop offset="1" stop-color="#d9efd8" stop-opacity="0.55"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="800" cy="330" r="120" fill="#e6f3d6" opacity="0.35"/>
<polygon points="{ridge(11, 560, 140)}" fill="#3f6d55" opacity="0.7"/>
{pines(12, 70, 640, 90, 170, "#35604a")}
<rect y="520" width="{W}" height="200" fill="url(#mist)"/>
{pines(13, 55, 780, 150, 260, "#1f4334")}
<rect y="700" width="{W}" height="160" fill="url(#mist)" opacity="0.6"/>
{pines(14, 40, 960, 260, 420, "#0d241c")}
<rect y="950" width="{W}" height="50" fill="#0d241c"/>""",
)

# 3. High sea: night ocean, moon and its reflection, waves.
waves = []
rnd = random.Random(21)
for i in range(9):
    y = 600 + i * 46
    amp = 10 + i * 4
    span = 120 + i * 30
    shift = rnd.uniform(0, span)
    d = f"M{-span - shift:.0f},{y} " + " ".join(
        f"Q{x + span / 2:.0f},{y - amp} {x + span:.0f},{y}" for x in range(int(-span - shift), W + span, span)
    )
    shade = ["#1c4e6b", "#1a4763", "#17405a", "#143850", "#123147", "#0f2a3d", "#0c2334", "#0a1d2b", "#081723"][i]
    waves.append(f'<path d="{d} L{W},{H} L0,{H} Z" fill="{shade}"/>')
rnd = random.Random(23)
glints = "".join(
    f'<ellipse cx="{800 + rnd.gauss(0, 8 + (y - 600) * 0.12):.0f}" cy="{y}" rx="{rnd.uniform(18, 40) + (y - 600) * 0.12:.0f}" ry="2.5" fill="#eaf6f2" opacity="{max(0.15, 0.8 - (y - 600) / 600):.2f}"/>'
    for y in range(612, 980, 16)
)
svg(
    "sea",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#07182b"/><stop offset="0.6" stop-color="#1d4f6e"/><stop offset="1" stop-color="#5fa3b3"/></linearGradient>
<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f6f4" stop-opacity="0.7"/><stop offset="1" stop-color="#e8f6f4" stop-opacity="0"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
{stars(22, 90, 420, rmax=1.8, opacity=0.7)}
<circle cx="800" cy="330" r="80" fill="#eaf6f2"/>
<circle cx="800" cy="330" r="150" fill="#eaf6f2" opacity="0.12"/>
{''.join(waves)}
{glints}""",
)

# 4. Embers: volcano under a red sky, glowing lava and sparks.
sparks = []
rnd = random.Random(31)
for _ in range(80):
    x = 800 + rnd.gauss(0, 170)
    y = rnd.uniform(80, 420)
    sparks.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(1, 3.2):.1f}" fill="#ffc46b" opacity="{rnd.uniform(0.3, 0.95):.2f}"/>')
svg(
    "embers",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#12070a"/><stop offset="0.55" stop-color="#5a1418"/><stop offset="1" stop-color="#b8382a"/></linearGradient>
<radialGradient id="crater" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27a"/><stop offset="0.4" stop-color="#ff7a3c" stop-opacity="0.8"/><stop offset="1" stop-color="#ff3c20" stop-opacity="0"/></radialGradient>
<linearGradient id="lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb04a"/><stop offset="1" stop-color="#d6361f"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="800" cy="440" r="300" fill="url(#crater)" opacity="0.8"/>
{''.join(sparks)}
<polygon points="-50,{H} 420,700 690,470 910,470 1180,700 1650,{H}" fill="#2a0d10"/>
<path d="M790,475 C770,560 830,620 800,700 C780,780 840,860 820,{H} L860,{H} C880,860 820,780 845,700 C870,620 810,560 820,475 Z" fill="url(#lava)" opacity="0.9"/>
<polygon points="{ridge(32, 900, 70)}" fill="#160708"/>""",
)

# 5. Starry night: violet sky, crescent moon, dark peaks.
svg(
    "night",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0b0a24"/><stop offset="0.6" stop-color="#2d2466"/><stop offset="1" stop-color="#6a4fa3"/></linearGradient>
<radialGradient id="nebula" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#b79cf2" stop-opacity="0.45"/><stop offset="1" stop-color="#b79cf2" stop-opacity="0"/></radialGradient>
<mask id="crescent"><rect width="{W}" height="{H}" fill="#fff"/><circle cx="832" cy="300" r="78" fill="#000"/></mask>""".replace("{W}", str(W)).replace("{H}", str(H)),
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<ellipse cx="760" cy="360" rx="520" ry="220" fill="url(#nebula)" transform="rotate(-18 760 360)"/>
{stars(41, 260, 700)}
<circle cx="800" cy="320" r="90" fill="#f4ecff" mask="url(#crescent)"/>
<polygon points="{peaks(42, 820, [260, 360, 300, 420, 280], [180, 520, 820, 1120, 1450], 190)}" fill="#1b1540"/>
<polygon points="{ridge(43, 930, 60)}" fill="#0c0a22"/>""",
)

# 6. Frozen peaks: cold sky, snowy mountains.
svg(
    "peaks",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#27425f"/><stop offset="0.6" stop-color="#8fb3cf"/><stop offset="1" stop-color="#dbe8f2"/></linearGradient>
<linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9fb8cc"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="1010" cy="210" r="56" fill="#f6fbff" opacity="0.85"/>
<polygon points="{peaks(51, 760, [300, 460, 380], [300, 800, 1300], 260)}" fill="url(#snow)"/>
<polygon points="{peaks(52, 860, [220, 280, 240, 300], [120, 560, 1020, 1480], 200)}" fill="#5f7f9c"/>
<polygon points="{ridge(53, 950, 60)}" fill="#2c4258"/>""",
)

# 7. Dunes: desert sun and sand waves.
dunes = []
for i, (base, color) in enumerate([(640, "#e2a65c"), (720, "#cf8a45"), (810, "#b06d35"), (900, "#8a5028")]):
    rnd = random.Random(60 + i)
    off = rnd.uniform(0, 600)
    d = f"M-100,{base} " + " ".join(
        f"C{x + 150},{base - 70 - 20 * i} {x + 250},{base - 70 - 20 * i} {x + 400},{base}"
        for x in range(int(-100 - off), W + 400, 400)
    )
    dunes.append(f'<path d="{d} L{W + 100},{H} L-100,{H} Z" fill="{color}"/>')
svg(
    "dunes",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#5a86b8"/><stop offset="0.6" stop-color="#e8c79a"/><stop offset="1" stop-color="#f6e2b8"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="800" cy="420" r="110" fill="#fff3d0"/>
<circle cx="800" cy="420" r="200" fill="#fff3d0" opacity="0.2"/>
{''.join(dunes)}""",
)

# 8. Blossom: pink dusk, round trees and falling petals.
petals = []
rnd = random.Random(71)
for _ in range(90):
    x, y = rnd.uniform(0, W), rnd.uniform(0, H)
    petals.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rnd.uniform(3, 7):.1f}" ry="{rnd.uniform(2, 4):.1f}" fill="#ffd9ea" opacity="{rnd.uniform(0.4, 0.9):.2f}" transform="rotate({rnd.uniform(0, 180):.0f} {x:.0f} {y:.0f})"/>')
crowns = []
rnd = random.Random(72)
for cx, cy, r in [(420, 560, 170), (800, 500, 210), (1190, 570, 160)]:
    crowns.append(f'<rect x="{cx - 12}" y="{cy}" width="24" height="{H - cy}" fill="#4a2a3a"/>')
    for _ in range(9):
        crowns.append(f'<circle cx="{cx + rnd.uniform(-r * 0.7, r * 0.7):.0f}" cy="{cy + rnd.uniform(-r * 0.6, r * 0.2):.0f}" r="{rnd.uniform(r * 0.35, r * 0.6):.0f}" fill="{rnd.choice(["#e889b3", "#f3a7c8", "#d9709f"])}" opacity="0.95"/>')
svg(
    "blossom",
    """<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#3b2446"/><stop offset="0.55" stop-color="#b8648e"/><stop offset="1" stop-color="#f4c2c8"/></linearGradient>""",
    f"""<rect width="{W}" height="{H}" fill="url(#sky)"/>
<polygon points="{ridge(73, 700, 80)}" fill="#8e4f73" opacity="0.6"/>
{''.join(crowns)}
<polygon points="{ridge(74, 900, 40)}" fill="#5a2f47"/>
{''.join(petals)}""",
)
print(sorted(os.listdir(OUT)))
