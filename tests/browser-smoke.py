#!/usr/bin/env python3
"""Real Chromium/WebGL smoke test; requires Python Playwright and Chromium.

Run: python tests/browser-smoke.py
Screenshots go to /tmp/pachiarucg-browser by default. Uses the production CDN
import map and normal certificate validation; no TLS/trust overrides or fixtures.
"""

import argparse
import hashlib
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def digest(image):
    return hashlib.sha256(image).hexdigest()


def assert_layout(page):
    layout = page.evaluate("""() => {
      const rect = document.querySelector('#stage').getBoundingClientRect();
      return {width: rect.width, height: rect.height,
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth};
    }""")
    assert layout["pageWidth"] <= layout["viewport"], layout
    assert abs(layout["width"] / layout["height"] - 9 / 16) < 0.003, layout


def check_viewport(browser, width, height, output_dir):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        is_mobile=width < 740, has_touch=True, device_scale_factor=1,
    )
    page = context.new_page()
    failures, errors = [], []
    page.on("requestfailed", lambda req: failures.append(f"{req.url}: {req.failure}"))
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(BASE_URL, wait_until="networkidle")
    try:
        page.locator("#loading").wait_for(state="hidden", timeout=20000)
    except Exception as exc:
        raise AssertionError({"loading": page.locator("#loading").inner_text(),
                              "requests": sorted(set(failures)),
                              "errors": sorted(set(errors))}) from exc
    assert page.locator("#stage canvas").count() == 1
    assert_layout(page)

    page.locator('[data-action="play"]').tap()
    assert page.locator('[data-action="play"]').get_attribute("aria-pressed") == "true"
    page.locator("#pause").tap()
    assert "停止中" in page.locator("#status").inner_text()
    canvas = page.locator("#stage canvas")
    still = digest(canvas.screenshot())
    page.wait_for_timeout(250)
    assert digest(canvas.screenshot()) == still, "Animation changed while paused"

    cameras = page.locator("[data-camera]")
    assert cameras.count() == 3
    frames = {}
    for view in ("player", "behind", "side"):
        button = page.locator(f'[data-camera="{view}"]')
        rect = button.bounding_box()
        assert rect["height"] >= 44, (view, rect)
        button.tap()
        assert button.get_attribute("aria-pressed") == "true"
        assert page.locator('[data-camera][aria-pressed="true"]').count() == 1
        page.wait_for_timeout(100)
        image = canvas.screenshot(path=str(output_dir / f"{width}-{view}.png"))
        frames[view] = digest(image)
        assert_layout(page)
        assert "停止中" in page.locator("#status").inner_text()
    assert len(set(frames.values())) == 3, "Camera views rendered identical frames"

    without_glasses = digest(canvas.screenshot())
    page.locator("#glasses").tap()
    assert page.locator("#glasses").is_checked()
    page.wait_for_timeout(100)
    assert digest(canvas.screenshot()) != without_glasses, "Glasses did not render"
    page.locator("#glasses").tap()
    assert not page.locator("#glasses").is_checked()
    page.locator("#speed").fill("1.5")
    assert page.locator("#speed-value").inner_text() == "1.5×"

    page.locator("#pause").tap()
    assert "再生中" in page.locator("#status").inner_text()
    before = digest(canvas.screenshot())
    page.wait_for_timeout(250)
    assert digest(canvas.screenshot()) != before, "Animation did not resume"

    for mode in ("idle", "look", "shock", "sad", "angry", "smile", "pretend"):
        button = page.locator(f'[data-action="{mode}"]')
        button.tap()
        assert button.get_attribute("aria-pressed") == "true"
    if width == 390:
        # Exercise the actual rendering path through notification and seven entry,
        # with screenshots suitable for visually checking the two distinct states.
        page.locator('[data-camera="player"]').tap()
        page.locator('[data-action="smile"]').tap()
        page.wait_for_function("document.querySelector('#machine-status').textContent"
                               ".includes('本人の台：ボーナス告知（7未入賞）')")
        page.locator("#pause").tap()
        assert "7未入賞" in page.locator("#machine-status").inner_text()
        canvas.screenshot(path=str(output_dir / "390-bonus-notified.png"))
        page.locator("#pause").tap()
        page.wait_for_function("document.querySelector('#machine-status').textContent"
                               ".includes('本人の台：7図柄入賞')")
        page.locator("#pause").tap()
        assert "本人の台：7図柄入賞" in page.locator("#machine-status").inner_text()
        canvas.screenshot(path=str(output_dir / "390-bonus-aligned.png"))
        page.locator("#pause").tap()
        page.wait_for_function("document.querySelector('#machine-status').textContent"
                               ".includes('本人の台：ボーナス消化')")
        page.wait_for_function("document.querySelector('#machine-status').textContent"
                               ".includes('本人の台：通常 ／ 隣の台：通常')")
    page.locator("#demo").tap()
    assert "一連の動作テスト" in page.locator("#status").inner_text()
    assert_layout(page)
    assert not failures, failures
    assert not errors, errors
    context.close()
    return {"viewport": f"{width}×{height}", "cameras": 3,
            "touchControls": "passed", "portraitAndOverflow": "passed",
            "pauseAndResume": "passed", "pageErrors": errors,
            "bonusSequence": "passed" if width == 390 else "checked at 390px"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/pachiarucg-browser"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[1]
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=root))
    BASE_URL = f"http://127.0.0.1:{server.server_port}/"
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=args.chromium, headless=True,
                args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                      "--enable-unsafe-swiftshader"],
            )
            results = [check_viewport(browser, w, h, args.output_dir)
                       for w, h in ((360, 800), (390, 844), (1280, 900))]
            browser.close()
            print(json.dumps({"tests": results, "screenshots": str(args.output_dir),
                              "tls": "normal verification; production CDN import"},
                             ensure_ascii=False, indent=2))
    finally:
        server.shutdown()
