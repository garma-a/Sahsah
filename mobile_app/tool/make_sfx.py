"""Generates the game's placeholder sound effects into assets/sfx/.

Plain synthesized tones, so the repository carries no third-party audio.
Replace any file with a real recording of the same name (16-bit mono WAV)
and the app picks it up; run this again to get the placeholders back.

    python tool/make_sfx.py
"""

import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')


def note(freq, ms, volume=0.6, decay=6.0, harmonics=(1.0, 0.35, 0.12)):
    """One bell-like note: a short attack, then an exponential fade."""
    count = int(RATE * ms / 1000)
    attack = int(RATE * 0.004)
    total = sum(harmonics)
    out = []
    for i in range(count):
        t = i / RATE
        wave_sum = sum(
            level * math.sin(2 * math.pi * freq * (k + 1) * t)
            for k, level in enumerate(harmonics)
        ) / total
        envelope = min(1.0, i / attack) * math.exp(-decay * t)
        # A short fade at the very end avoids a click.
        envelope *= min(1.0, (count - i) / (RATE * 0.005))
        out.append(volume * envelope * wave_sum)
    return out


def silence(ms):
    return [0.0] * int(RATE * ms / 1000)


def mix(*tracks):
    """Lays tracks on top of each other; each is (offset_ms, samples)."""
    length = max(int(RATE * off / 1000) + len(s) for off, s in tracks)
    out = [0.0] * length
    for off, samples in tracks:
        start = int(RATE * off / 1000)
        for i, v in enumerate(samples):
            out[start + i] += v
    return out


def save(name, samples):
    peak = max(1.0, max(abs(v) for v in samples))
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(
            b''.join(
                struct.pack('<h', int(32767 * v / peak)) for v in samples
            )
        )


C5, E5, G5, C6 = 523.25, 659.25, 783.99, 1046.5

# Last ten seconds: a dry clock tick.
save('tick', note(1250, 45, volume=0.5, decay=70, harmonics=(1.0, 0.5)))

# Time is up: two falling notes, a little buzzy.
save(
    'time_up',
    mix(
        (0, note(392, 260, volume=0.7, decay=4, harmonics=(1, 0.6, 0.4, 0.2))),
        (230, note(294, 420, volume=0.7, decay=4, harmonics=(1, 0.6, 0.4, 0.2))),
    ),
)

# Points awarded: a quick rising chime.
save(
    'correct',
    mix(
        (0, note(C5, 220, decay=9)),
        (85, note(E5, 220, decay=9)),
        (170, note(G5, 420, decay=6)),
    ),
)

# Nobody got it: one soft low note.
save('nobody', note(233, 260, volume=0.4, decay=9, harmonics=(1.0, 0.2)))

# Game over: a short fanfare ending on a held chord.
save(
    'win',
    mix(
        (0, note(C5, 240, decay=7)),
        (140, note(E5, 240, decay=7)),
        (280, note(G5, 240, decay=7)),
        (420, note(C6, 900, volume=0.7, decay=3)),
        (420, note(G5, 900, volume=0.4, decay=3)),
        (420, note(E5, 900, volume=0.4, decay=3)),
    ),
)

print('wrote', sorted(os.listdir(OUT)))
