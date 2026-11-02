"""Build a steady, periodic engine bed from dklon's CC BY 3.0 takeoff effect.

Requires NumPy only for rebuilding the bundled WAV; the app has no dependency.
Source: https://opengameart.org/content/jet-engine-takeoff
"""
from pathlib import Path
import wave

import numpy as np

audio_dir = Path(__file__).resolve().parents[1] / 'public' / 'audio'
with wave.open(str(audio_dir / 'jet.wav')) as reader:
    source_rate = reader.getframerate()
    source = np.frombuffer(reader.readframes(reader.getnframes()), dtype='<i2') / 32768.0

# Keep the steady engine timbre, discarding the takeoff's pitch/envelope motion.
clip = source[int(.45 * source_rate):int(1.8 * source_rate)]
size = 8192
window = np.hanning(size)
power = np.mean([
    abs(np.fft.rfft(clip[start:start + size] * window)) ** 2
    for start in range(0, len(clip) - size, size // 2)
], axis=0)
freq = np.fft.rfftfreq(size, 1 / source_rate)

# Smooth spectral peaks so a short, recognisable whistle cannot repeat.
kernel = np.hanning(65)
kernel /= kernel.sum()
envelope = np.sqrt(np.convolve(power, kernel, mode='same'))
rate, duration = 32000, 48
count = rate * duration
target_freq = np.fft.rfftfreq(count, 1 / rate)
shape = np.interp(target_freq, freq, envelope)
shape *= target_freq ** 2 / (target_freq ** 2 + 45 ** 2)
shape *= 1 / np.sqrt(1 + (target_freq / 3200) ** 6)
shape *= 1 + .75 * np.exp(-(target_freq / 350) ** 2)
shape *= 1 - .35 * np.exp(-((target_freq - 1800) / 1000) ** 2)

rng = np.random.default_rng(4387)
spectrum = shape * np.exp(1j * rng.uniform(0, 2 * np.pi, len(shape)))
spectrum[0] = spectrum[-1] = 0
signal = np.fft.irfft(spectrum, n=count)
time = np.arange(count) / rate
# Very small irregular motion, periodic over the whole bed to keep the seam clean.
signal *= 1 + .018 * np.sin(2 * np.pi * 5 * time / duration) + .012 * np.sin(2 * np.pi * 11 * time / duration + .7)
signal *= .12 / np.sqrt(np.mean(signal ** 2))
assert abs(signal).max() < .95
pcm = np.round(signal * 32767).astype('<i2')
with wave.open(str(audio_dir / 'jet-cruise.wav'), 'wb') as writer:
    writer.setnchannels(1)
    writer.setsampwidth(2)
    writer.setframerate(rate)
    writer.writeframes(pcm.tobytes())

print(f'jet-cruise.wav: {duration}s, {rate}Hz, peak {abs(signal).max():.3f}, RMS {np.sqrt(np.mean(signal ** 2)):.3f}')
