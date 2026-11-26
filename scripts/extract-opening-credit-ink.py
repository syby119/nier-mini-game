"""Rebuild the opening ink sheets from the supplied 640×360 _FINALE_0.mp4.
Usage: python scripts/extract-opening-credit-ink.py VIDEO [--output DIR]
Offline dependencies: PyAV, NumPy and Pillow.
"""

import argparse
import json
import math
from pathlib import Path

import av
import numpy as np
from PIL import Image


ASSETS = Path(__file__).resolve().parents[1] / 'public/images/opening-credits'
FIRST, HOLD, REWIND, END = 1644, 2139, 2764, 2802
LEFT, RIGHT = 136, 530
HEIGHT, HALF = 17, 8
SHEET_WIDTH, SHEET_FRAMES = 1536, 60
PLATE_LEFT, PLATE_WIDTH, OVERSCAN = 128, 416, 34


def offset(frame):
    if frame >= REWIND:
        return -(frame - REWIND + 1) * 64.4
    return min(0, (frame - HOLD) * 48.3 / 30)


def load_frames(path):
    frames = np.empty((END - FIRST, 360, 640, 4), dtype=np.uint8)
    choices = np.zeros(len(frames), dtype=bool)
    dialogue = np.zeros_like(choices)
    with av.open(str(path)) as source:
        stream = source.streams.video[0]
        if (stream.width, stream.height, stream.average_rate) != (640, 360, 30):
            raise ValueError('Expected the 640×360, 30 fps opening reference')
        source.seek(int(FIRST / (30 * stream.time_base)), stream=stream)
        count = 0
        for frame in source.decode(stream):
            n = round(frame.pts * frame.time_base * 30)
            if n < FIRST:
                continue
            if n >= END:
                break
            plane = frame.reformat(format='yuv420p').planes[0]
            luma = np.frombuffer(plane, np.uint8).reshape(360, plane.line_size)[:, :640].astype(np.int16)
            tile = frames[n - FIRST]
            tile[:, :, :3] = frame.to_ndarray(format='rgb24')
            tile[:, :, 3] = np.where(luma >= 47, (luma - 42) // 2, 0)
            choices[n - FIRST] = np.median(luma[252, 520:580]) > 47
            dialogue[n - FIRST] = np.median(luma[300, 180:216]) > 46
            count += 1
        if count != len(frames):
            raise ValueError('The opening reference is incomplete')
    return frames, choices, dialogue


def ranges(numbers):
    result = []
    for n in numbers:
        if result and result[-1][1] == n and n != REWIND:
            result[-1][1] = n + 1
        else:
            result.append([n, n + 1])
    return result


def visible_source(x, y, choices, dialogue):
    # Exclude the webcam, donation graphics, Pod nameplate and dialogue.
    valid = (y >= 0) & (y < 360) & ~((y >= 120) & (x < 150))
    valid &= ~((y >= 252) & (x < 159))
    valid &= ~((y >= 291) & (x >= 491))
    valid &= ~((y >= 306) & (x >= 368))
    if choices:
        valid &= ~((y >= 242) & (y <= 282) & (x >= 340))
    if dialogue:
        valid &= y < 281
    return valid


def sample_credit(name, anchor, frames, choices, dialogue):
    x = np.arange(LEFT, RIGHT)[None, :]

    def crop(n, center):
        y = center + np.arange(-HALF, HALF + 1)[:, None]
        ink = frames[n - FIRST, np.clip(y[:, 0], 0, 359), LEFT:RIGHT]
        valid = visible_source(x, y, choices[n - FIRST], dialogue[n - FIRST])
        return ink, valid

    full = {}
    for n in range(FIRST, END):
        center = round(anchor + offset(n))
        if (-2 if anchor == 1 else 4) <= center <= 235:
            ink, valid = crop(n, center)
            full[n] = np.where(valid[:, :, None], ink, 0)

    hits = (np.stack([ink[:, :, 3] for ink in full.values()]) >= 6).any(axis=1).sum(axis=0)
    strokes = np.flatnonzero(hits >= max(1, int(.003 * len(full))))
    left = max(0, int(strokes[0]) - 4)
    right = min(RIGHT - LEFT, int(strokes[-1]) + 5)
    passes = [[n for n in full if (n >= REWIND) == rewind] for rewind in (False, True)]
    tiles = {}
    for n in range(FIRST, END):
        center = round(anchor + offset(n))
        if not -HALF <= center < 360 + HALF:
            continue
        ink, valid = crop(n, center)
        ink, valid = ink[:, left:right], valid[:, left:right]
        if valid[HALF - 2:HALF + 3].mean() < .13:
            continue
        if not valid.all():
            samples = passes[int(n >= REWIND)] or list(full)
            length = len(samples) - 1
            step = abs(n - samples[0]) % (2 * length) if length else 0
            nearby = full[samples[min(step, 2 * length - step)]]
            ink = np.where(valid[:, :, None], ink, nearby[:, left:right])
        tiles[n] = ink
    row = dict(name=name, y=anchor, x=left + LEFT, width=right - left, spans=ranges(tiles), blocks=[])
    return row, tiles


def save_sheet(bitmap, path):
    mask = (bitmap[:, :, 3] > 0).astype(np.uint8) * 255
    background = np.array([31, 31, 29], dtype=np.uint8)
    paper = Image.fromarray(np.where(mask[:, :, None], bitmap[:, :, :3], background))
    h, w = mask.shape
    across = np.pad(mask, ((0, 0), (3, 3)), mode='edge')
    wide = np.maximum.reduce([across[:, i:i + w] for i in range(7)])
    padded = np.pad(wide, ((1, 1), (0, 0)), mode='edge')
    margin = np.maximum.reduce([padded[i:i + h] for i in range(3)])
    paper.putalpha(Image.fromarray(margin))
    paper.save(path, quality=81, method=5)


def rewind_sheets(frames, choices, dialogue, output):
    # At high speed the original has different line breaks and spacing. Use
    # the visible field itself and borrow overscan from adjacent source frames.
    plate_height = 360 + 2 * OVERSCAN
    first_page = math.ceil((END - FIRST) / SHEET_FRAMES)
    x = np.arange(PLATE_LEFT, PLATE_LEFT + PLATE_WIDTH)[None, :]
    for start in range(REWIND, END, 12):
        count = min(12, END - start)
        bitmap = np.zeros((math.ceil(count / 3) * plate_height, 3 * PLATE_WIDTH, 4), dtype=np.uint8)
        for cell in range(count):
            n = start + cell
            left, top = cell % 3 * PLATE_WIDTH, cell // 3 * plate_height
            tile = bitmap[top:top + plate_height, left:left + PLATE_WIDTH]
            filled = np.zeros(tile.shape[:2], dtype=bool)
            nearby = sorted(range(max(REWIND - 1, n - 6), min(END, n + 7)), key=lambda k: abs(k - n))
            for k in nearby:
                y = np.arange(-OVERSCAN, 360 + OVERSCAN)[:, None] + round(offset(k) - offset(n))
                valid = ~filled & visible_source(x, y, choices[k - FIRST], dialogue[k - FIRST])
                ink = frames[k - FIRST, np.clip(y[:, 0], 0, 359), PLATE_LEFT:PLATE_LEFT + PLATE_WIDTH]
                tile[valid] = ink[valid]
                filled |= valid
        page = first_page + (start - REWIND) // 12
        save_sheet(bitmap, output / f'{page:02}.webp')


def extract(video, output):
    frames, choices, dialogue = load_frames(video)
    # Names and vertical anchors are the hand-registered part of the capture index.
    anchors = json.loads((ASSETS / 'index.json').read_text(encoding='utf8'))
    credits = [sample_credit(r['name'], r['y'], frames, choices, dialogue) for r in anchors]
    output.mkdir(parents=True, exist_ok=True)
    for page, start in enumerate(range(FIRST, END, SHEET_FRAMES)):
        placements = []
        height = 0
        for row, tiles in credits:
            width = row['width']
            columns = SHEET_WIDTH // width
            for begin, end in row['spans']:
                begin, end = max(begin, start), min(end, start + SHEET_FRAMES)
                if begin >= end:
                    continue
                row['blocks'].append([begin, end, page, height])
                for i, n in enumerate(range(begin, end)):
                    placements.append((i % columns * width, height + i // columns * HEIGHT, tiles[n]))
                height += math.ceil((end - begin) / columns) * HEIGHT
        bitmap = np.zeros((height, SHEET_WIDTH, 4), dtype=np.uint8)
        for x, y, tile in placements:
            bitmap[y:y + HEIGHT, x:x + tile.shape[1]] = tile
        save_sheet(bitmap, output / f'{page:02}.webp')
    rewind_sheets(frames, choices, dialogue, output)
    records = [json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r, _ in credits]
    (output / 'index.json').write_text('[\n' + ',\n'.join(records) + '\n]\n', encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--output', type=Path, default=ASSETS)
    args = parser.parse_args()
    extract(args.video, args.output)
