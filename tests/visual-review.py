#!/usr/bin/env python3
"""Capture the actual WebGL scene for visual review on two mobile viewports.

Run static captures before adding motion:
    python tests/visual-review.py --phase static --output-dir /tmp/pachiarucg-static-review
Run the final review sequentially to limit software-GPU load:
    python tests/visual-review.py --phase static --device-scale-factor 2 --output-dir review --interface
    python tests/visual-review.py --phase motion --device-scale-factor 1 --output-dir review

Requires Python Playwright, Pillow, and Chromium. All requests retain normal TLS
verification. The generated gallery contains browser captures, not scene assets.
"""

import argparse
import hashlib
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
from urllib.parse import urlencode

from PIL import Image
from playwright.sync_api import sync_playwright


VIEWS = {"player": "A：打ち手操作視点", "behind": "B：背後からの肩越し", "side": "C：斜め前方の3/4視点"}
VIEWPORTS = ((360, 800), (390, 844))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def frame_stats(data):
    image = Image.open(BytesIO(data)).convert("RGB")
    colors = len(image.resize((120, 214)).getcolors(120 * 214) or [])
    assert colors > 300, f"Scene appears empty or nearly flat ({colors} sampled colors)"
    return {"pixels": list(image.size), "sampledColors": colors}


def layout(page):
    dimensions = page.evaluate("""() => {
      const stage = document.querySelector('#stage').getBoundingClientRect();
      const canvas = document.querySelector('#stage canvas');
      return {stageWidth: stage.width, stageHeight: stage.height,
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        canvasWidth: canvas.width, canvasHeight: canvas.height};
    }""")
    assert dimensions["pageWidth"] <= dimensions["viewport"], dimensions
    assert abs(dimensions["stageWidth"] / dimensions["stageHeight"] - 9 / 16) < .003, dimensions
    assert dimensions["canvasWidth"] > 0 and dimensions["canvasHeight"] > 0, dimensions
    return dimensions


def open_review(browser, base_url, width, height, motion, pixel_ratio=2):
    context = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=pixel_ratio, is_mobile=True, has_touch=True)
    page = context.new_page()
    page.set_default_timeout(30000)
    errors, failures, warnings = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("requestfailed", lambda request: failures.append({"url": request.url, "error": request.failure}))
    page.on("console", lambda message: warnings.append(message.text) if message.type == "warning" else None)
    query = urlencode({"review": "1", "camera": "side", "motion": "on" if motion else "off"})
    print(f"Opening {width}x{height}, DPR {pixel_ratio}, motion={motion}", flush=True)
    page.goto(base_url + ("&" if "?" in base_url else "?") + query, wait_until="networkidle")
    try:
        page.locator("#loading").wait_for(state="hidden", timeout=60000)
    except Exception as error:
        raise AssertionError({"loading": page.locator("#loading").inner_text(),
                              "errors": errors, "failedRequests": failures}) from error
    assert page.locator("#stage canvas").count() == 1
    print("3D model loaded", flush=True)
    return context, page, errors, failures, warnings


def capture_static(browser, base_url, width, height, output, pixel_ratio=2, selected_views=None, interface=False):
    context, page, errors, failures, warnings = open_review(browser, base_url, width, height, False, pixel_ratio)
    canvas = page.locator("#stage canvas")
    captures = []
    for view in selected_views or VIEWS:
        label = VIEWS[view]
        print(f"Capturing {width}-{view}", flush=True)
        button = page.locator(f'[data-camera="{view}"]')
        assert button.count() == 1
        button.tap()
        assert button.get_attribute("aria-pressed") == "true"
        assert page.locator('[data-camera][aria-pressed="true"]').count() == 1
        assert button.bounding_box()["height"] >= 44
        page.wait_for_timeout(250)
        dimensions = layout(page)
        filename = f"{width}-{view}.png"
        frame = canvas.screenshot(path=str(output / "images" / filename))
        page.wait_for_timeout(200)
        assert digest(canvas.screenshot()) == digest(frame), "The static review pose changed while paused"
        captures.append({"view": view, "label": label, "file": f"images/{filename}",
                         "sha256": digest(frame), **frame_stats(frame), "layout": dimensions})
    assert len({item["sha256"] for item in captures}) == len(captures), "The cameras show identical frames"
    if interface:
        page.screenshot(path=str(output / "images" / f"{width}-interface.png"), full_page=True)
    diagnostics = page.evaluate("""() => {
      const value = window.__PACHI_REVIEW__;
      return typeof value === 'function' ? value() : value || null;
    }""")
    assert not errors, errors
    assert not failures, failures
    context.close()
    return {"viewport": [width, height], "pixelRatio": pixel_ratio, "captures": captures,
            "diagnostics": diagnostics, "warnings": warnings, "errors": errors, "failedRequests": failures}


def verify_motion(browser, base_url, output, pixel_ratio=2):
    context, page, errors, failures, warnings = open_review(browser, base_url, 390, 844, True, pixel_ratio)
    initial_diagnostics = page.evaluate("window.__PACHI_REVIEW__")
    canvas = page.locator("#stage canvas")
    page.locator('[data-action="play"]').tap()
    page.wait_for_timeout(300)
    first = digest(canvas.screenshot())
    page.wait_for_timeout(400)
    assert digest(canvas.screenshot()) != first, "The real 3D character did not animate"
    page.locator("#pause").tap()
    page.wait_for_timeout(100)
    still = canvas.screenshot(path=str(output / "images" / "390-play-paused.png"))
    page.wait_for_timeout(250)
    assert digest(canvas.screenshot()) == digest(still), "Pause did not freeze the rig"
    page.locator("#glasses").tap()
    page.wait_for_timeout(100)
    with_glasses = canvas.screenshot(path=str(output / "images" / "390-glasses.png"))
    assert digest(with_glasses) != digest(still), "The glasses accessory did not render"
    page.locator("#glasses").tap()
    paused_time = page.evaluate("window.__PACHI_REVIEW__.diagnostics.time")
    page.locator("#pause").tap()
    page.wait_for_function("previous => window.__PACHI_REVIEW__.diagnostics.time > previous + .12",
                           arg=paused_time)
    assert "再生中" in page.locator("#status").inner_text(), "Animation did not resume"
    poses = {}
    for action in ("look", "sad", "pretend"):
        page.locator(f'[data-action="{action}"]').tap()
        # Allow the damped skeleton to settle in animation time. Software WebGL
        # can advance fewer frames than a phone GPU during a fixed wall delay.
        page.wait_for_function("window.__PACHI_REVIEW__.diagnostics.time >= 1")
        page.locator("#pause").tap()
        poses[action] = page.evaluate("window.__PACHI_REVIEW__.diagnostics.pose")
        frame = canvas.screenshot(path=str(output / "images" / f"390-motion-{action}.png"))
        frame_stats(frame)
        layout(page)
    page.locator("#speed").fill("1.5")
    assert page.locator("#speed-value").inner_text() == "1.5×"
    if page.locator("#study").count():
        page.locator("#study").tap()
        assert "停止中" in page.locator("#status").inner_text()
        study = digest(canvas.screenshot())
        page.wait_for_timeout(250)
        assert digest(canvas.screenshot()) == study, "The study reset did not hold a static pose"
        page.locator("#glasses").tap()
        page.wait_for_timeout(100)
        glasses_study = canvas.screenshot(path=str(output / "images" / "390-glasses-study.png"))
        assert digest(glasses_study) != study, "The study glasses did not render"
        page.locator("#glasses").tap()
    assert not errors, errors
    assert not failures, failures
    context.close()
    return {"viewport": [390, 844], "pixelRatio": pixel_ratio,
            "motion": "passed", "pauseResume": "passed",
            "glasses": "passed", "touch": "passed", "poses": poses,
            "initialDiagnostics": initial_diagnostics,
            "errors": errors, "warnings": warnings}


def write_gallery(output, results):
    groups = []
    for result in results:
        width, height = result["viewport"]
        figures = "".join(f'<figure><img src="{capture["file"]}" alt="{capture["label"]}" loading="lazy">'
                          f'<figcaption>{capture["label"]}</figcaption></figure>' for capture in result["captures"])
        groups.append(f'<section><h2>{width} × {height} / DPR {result["pixelRatio"]}</h2><div class="shots">{figures}</div></section>')
    html = '''<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PachiAruCG — 3視点の実レンダリング比較</title>
<style>*{box-sizing:border-box}body{margin:0;background:#14191e;color:#f4eee3;font:16px/1.7 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:24px 18px}h1{font-size:clamp(22px,4vw,34px)}h2{font-size:18px}
p{color:#c3c7c7}a{color:#e6b88c}.shots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
figure{margin:0}img{display:block;width:100%;height:auto;border-radius:10px;background:#242b31}figcaption{padding:9px 0}
section{margin:32px 0 40px}@media(max-width:600px){.shots{grid-template-columns:1fr;gap:22px}figure{max-width:390px;margin:auto;width:100%}}</style>
<main><h1>3視点の実レンダリング比較</h1><p>同じ3D人物・筐体・ポーズをブラウザで描画して撮影した画像です。
このページの画像を3Dプレビューの代わりには使用していません。</p><p><a href="../?review=1&amp;motion=off">動かせる3Dプレビューを開く</a></p>'''
    (output / "index.html").write_text(html + "".join(groups) + "</main></html>", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("static", "motion", "all"), default="static")
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/pachiarucg-static-review"))
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--device-scale-factor", type=float, default=2)
    parser.add_argument("--viewport", choices=("both", "360", "390"), default="both")
    parser.add_argument("--camera", choices=("all", *VIEWS), default="all")
    parser.add_argument("--interface", action="store_true", help="Also save the full page UI")
    parser.add_argument("--base-url", help="Use an existing server instead of starting a local one")
    args = parser.parse_args()
    (args.output_dir / "images").mkdir(parents=True, exist_ok=True)
    server = None
    if args.base_url:
        base_url = args.base_url
    else:
        root = Path(__file__).resolve().parents[1]
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=root))
        Thread(target=server.serve_forever, daemon=True).start()
        base_url = f"http://127.0.0.1:{server.server_port}/"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.chromium, headless=True,
                args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            viewports = [size for size in VIEWPORTS if args.viewport == "both" or str(size[0]) == args.viewport]
            selected_views = list(VIEWS) if args.camera == "all" else [args.camera]
            results = [capture_static(browser, base_url, width, height, args.output_dir,
                                      args.device_scale_factor, selected_views, args.interface)
                       for width, height in viewports] if args.phase != "motion" else []
            report_path = args.output_dir / "verification.json"
            if results:
                # Keep completed static evidence even if the later motion phase
                # times out on a software-rendering host.
                write_gallery(args.output_dir, results)
                report_path.write_text(json.dumps({"phase": "static", "source": "real Chromium WebGL rendering",
                    "tls": "normal verification; no certificate or trust override", "static": results,
                    "motion": None}, ensure_ascii=False, indent=2), encoding="utf-8")
            elif args.phase == "motion" and report_path.exists():
                results = json.loads(report_path.read_text(encoding="utf-8")).get("static", [])
            motion = verify_motion(browser, base_url, args.output_dir, args.device_scale_factor) if args.phase != "static" else None
            browser.close()
        if results and args.phase != "motion":
            write_gallery(args.output_dir, results)
        report = {"phase": "all" if results and motion else args.phase, "source": "real Chromium WebGL rendering",
                  "tls": "normal verification; no certificate or trust override", "static": results, "motion": motion}
        (args.output_dir / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"phase": args.phase, "viewports": [result["viewport"] for result in results],
                          "screenshots": str(args.output_dir), "motion": motion}, ensure_ascii=False, indent=2))
    finally:
        if server:
            server.shutdown()


if __name__ == "__main__":
    main()
