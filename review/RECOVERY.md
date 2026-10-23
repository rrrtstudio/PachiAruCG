# 復旧・保存記録

元の作業環境に残っていた未保存ファイルを確認し、制作途中の状態を先にGitHubへ保存しました。

保存ブランチ: `visual/character-study`  
最初の保存コミット: [`82017fc`](https://github.com/rrrtstudio/PachiAruCG/commit/82017fca0b2307526894df161d55760bf6de3015)  
保存対象: 37ファイル

未保存変更の削除、作業ブランチの強制リセット、main・Pagesへの反映は行っていません。最初のpushはGitHubのメール非公開保護で拒否されたため、ファイルツリーを保ったまま未公開コミットの著者情報を公開用noreplyアドレスへ修正しました。元のローカルコミットもbackupブランチに保持しています。

## 保存した全ファイル

| ファイル | 保存時のバイト数 |
| --- | ---: |
| `app.js` | 6692 |
| `assets/character.glb` | 3022108 |
| `camera-views.js` | 1687 |
| `index.html` | 4912 |
| `review/before/360-behind.png` | 171171 |
| `review/before/360-player.png` | 106947 |
| `review/before/360-side.png` | 165535 |
| `review/before/390-behind.png` | 176219 |
| `review/before/390-player.png` | 110272 |
| `review/before/390-side.png` | 169807 |
| `review/before/source.json` | 445 |
| `review/images/360-behind.png` | 472234 |
| `review/images/360-interface.png` | 857391 |
| `review/images/360-player.png` | 441068 |
| `review/images/360-side.png` | 514015 |
| `review/images/390-behind.png` | 502236 |
| `review/images/390-interface.png` | 905320 |
| `review/images/390-player.png` | 479119 |
| `review/images/390-side.png` | 538624 |
| `review/index.html` | 2173 |
| `review/verification.json` | 8284 |
| `scene/cabinet.js` | 18756 |
| `scene/character.js` | 2209 |
| `scene/geometry.js` | 2989 |
| `scene/room.js` | 4345 |
| `tests/browser-smoke.py` | 7421 |
| `tests/camera-views.test.js` | 5651 |
| `tests/visual-review.py` | 11761 |
| `tools/build-character.py` | 18507 |
| `vendor/three/LICENSE` | 1081 |
| `vendor/three/README.md` | 455 |
| `vendor/three/addons/environments/RoomEnvironment.js` | 3623 |
| `vendor/three/addons/geometries/RoundedBoxGeometry.js` | 4625 |
| `vendor/three/addons/loaders/GLTFLoader.js` | 109831 |
| `vendor/three/addons/utils/BufferGeometryUtils.js` | 31768 |
| `vendor/three/manifest.json` | 732 |
| `vendor/three/three.module.js` | 1284652 |

## GLBの保存時検証

- glTF 2.0のヘッダーとファイル長が正常
- 1 skin、17 joints
- SHA-256: `dd10cbaa6e6c3834d0f5281d07d9300291a08f020f0f461db1e852e17af1977a`

以降の造形・動作改善は、この保存済み状態に対する追加コミットとして記録します。
