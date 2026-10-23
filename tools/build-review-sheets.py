#!/usr/bin/env python3
"""Arrange actual browser captures for review; never used by the 3D scene."""

from pathlib import Path
import argparse

from PIL import Image, ImageDraw, ImageFont


def sheet(paths, labels, target, title, font_path, width=336, crop=None):
    margin, gap, top = 24, 18, 94 if title else 68
    photos = []
    for path in paths:
        with Image.open(path) as source:
            if crop:
                source = source.crop(tuple(round(value * dimension) for value, dimension in
                    zip(crop, (source.width, source.height, source.width, source.height), strict=True)))
            height = round(source.height * width / source.width)
            photos.append(source.convert("RGB").resize((width, height), Image.Resampling.LANCZOS))
    canvas = Image.new("RGB", (margin * 2 + width * len(photos) + gap * (len(photos) - 1),
                               top + max(image.height for image in photos) + margin), "#121b23")
    draw = ImageDraw.Draw(canvas)
    label_font = ImageFont.truetype(font_path, 20)
    title_font = ImageFont.truetype(font_path, 26)
    if title:
        draw.text((margin, 18), title, font=title_font, fill="#f4eee3")
    for index, (photo, label) in enumerate(zip(photos, labels, strict=True)):
        x = margin + index * (width + gap)
        draw.text((x, top - 34), label, font=label_font, fill="#ccd4dc")
        canvas.paste(photo, (x, top))
    canvas.save(target, quality=92, subsampling=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", default="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / "review"
    images = root / "images"
    for width, height in ((360, 800), (390, 844)):
        sheet([images / f"{width}-{view}.png" for view in ("player", "behind", "side")],
              ["A：台と操作部", "B：肩越し", "C：顔と手元"], images / f"{width}-comparison.jpg",
              f"PachiAruCG / {width} × {height}", args.font)
    sheet([root / "before/390-side.png", images / "390-side.png"],
          ["改善前", "改善後（構図も更新）"], images / "before-after-side.jpg", "", args.font, width=365)
    previous = root / "iterations/study-01/images"
    if previous.exists():
        for width, height in ((360, 800), (390, 844)):
            sheet([previous / f"{width}-side.png", images / f"{width}-side.png"],
                  ["前回（4ece95a）", "今回（Cを調整）"], images / f"{width}-c-study-comparison.jpg",
                  f"{width} × {height} / C：顔と手元", args.font, width=400)
        sheet([previous / "390-side.png", images / "390-side.png"],
              ["前回", "今回"], images / "c-hands-comparison.jpg",
              "同じC画像の手元を拡大", args.font, width=500, crop=(.10, .40, .90, .67))


if __name__ == "__main__":
    main()
