# GitHub運用

スマホからCodexへ制作・修正を指示した後、同一リポジトリの `codex/` ブランチでPRを作成し、テスト成功後にmainへマージ・GitHub Pagesへ公開する構成です。CG・人物・筐体・カメラ・アニメーションの実装には運用のための変更を加えていません。

## 初回の有効化

1. このワークフローを追加するPRを、現在の保護ルールに従ってmainへマージします。`workflow_run` の制御コードはmain上のものだけを使用するため、導入PR自身には新しい自動マージ処理がまだ適用されません。
2. **Settings → Pages → Build and deployment → Source** が **GitHub Actions** であることを確認します。従来の **Deploy from a branch** なら切り替えが必要です。
3. 必要なら **Actions → Deploy GitHub Pages → Run workflow → main** で初回公開を実行します。公開先は https://rrrtstudio.github.io/PachiAruCG/ です。

導入時に確認できた設定は、mainの保護が有効、必須チェックがGitHub Actions提供の `test`（app ID `15368`）、squash mergeとリポジトリのAllow auto-mergeが有効、Pagesが存在することです。設定は変更していません。接続ツールでは保護の全詳細が403、Pagesの設定APIが未対応のため、PagesのSourceと環境の承認条件までは確認できません。組織のポリシーや `github-pages` 環境で承認が必要な場合、その条件も引き続き適用されます。

管理者PAT、保護の無効化、ActionsのPR承認許可は不要です。ジョブごとに下記の権限を指定しています。組織ポリシーがこれを許可していなければ、該当権限について管理者の設定確認が必要です。ブランチ保護を緩める対応はしません。

## 自動マージの条件

`Reel and camera checks` の完了イベントをmain上の制御ワークフローが受け取り、GitHub APIから再取得した情報で次を確認します。

- `main` 向けのopen・非ドラフトPRで、head/baseのrepository IDがこのリポジトリと一致する。
- ブランチ名が `codex/` で始まり、テスト済みSHAが現在のPR headと一致する。
- 正規の `.github/workflows/test.yml` のPRテストで、最新run・最新attemptが成功している。
- 実際の `test` ジョブも完了・成功している。skipped・neutralは成功と扱わない。
- mainの保護と必須 `test` を確認でき、PRが競合や未達の保護条件なくマージ可能である。

一致したhead SHAを指定してGitHubの通常のsquash merge APIを呼びます。残りの保護条件はGitHubがサーバー側で適用します。管理者権限・保護回避・レビューの自動承認・設定変更は使いません。リポジトリのAllow auto-merge設定を変更する処理もありません。これはテスト完了後のActionsによるマージ処理で、未完了のテストを無視するものではありません。

新しいコミット・新しいテスト実行・再試行がある場合、古い成功イベントは無視します。ドラフト解除やbase変更でも `test` を再実行します。外部フォーク・別のブランチ名・ドラフトにはマージやコメントを行いません。

制御ジョブがcheckoutするのは信頼済みmainのワークフローSHAだけです。PRのコード・artifact・cacheを、書き込み権限を持つジョブへ読み込んで実行しません。Actions自体も確認済みのコミットSHAに固定しています。

## Pages公開

`GITHUB_TOKEN` が行ったマージでは、通常のpushワークフローが起動しません。そのためマージ完了後に再利用可能な `deploy-pages.yml` を明示的に呼びます。人によるmainへのマージ・pushと、main上の手動再実行にも対応します。

ビルドはmainの確定SHAを取得して再テストし、公開に必要な6ファイルと `.nojekyll` だけをartifactに入れます。`.github`・テスト・ドキュメント・ZIPは公開対象に含めません。公開処理は共通のconcurrency groupで直列化し、開始時とビルド後にmainが先へ進んでいた古いSHAはスキップします。

| ジョブ | GITHUB_TOKEN権限 |
| --- | --- |
| 必須 `test` | `contents: read` |
| 自動マージとPRへの報告 | `contents: write`, `pull-requests: write`, `actions: read` |
| Pagesの再テスト・ビルド | `contents: read` |
| Pages公開 | `pages: write`, `id-token: write` |

運用・公開ワークフローのグローバル権限は空にし、公開権限やOIDC権限を持つジョブでnpmスクリプトを実行しません。`workflow_call` の呼び出し元では再利用先に必要な権限を渡しますが、ビルドと公開の各ジョブでは表の範囲まで絞ります。

## 失敗時

- テスト失敗・キャンセル・スキップ、保護の確認失敗、マージ不可、APIの拒否はマージせず、PRコメントとActions summaryに理由と実行リンクを出します。同じbotコメントを更新し、繰り返し通知を増やしません。コメント権限が拒否された場合も実行は失敗し、ログ・summaryで確認できます。
- テストはPRブランチで修正してpush、または最新の `Reel and camera checks` を再実行します。レビュー待ちや競合があれば解消後に再実行します。
- Pagesだけが失敗した場合、マージ済みコードはmainに残ります。Source・権限・環境条件と失敗ログを確認して、main上の `Deploy GitHub Pages` を手動再実行できます。過去のSHAを指定して巻き戻す手順は用意していません。

Actionsの通知はGitHubの通知設定に従います。別のメールや外部サービスへ送る仕組みや、定期監視は追加していません。

## 検証

```sh
npm run check
npm test
```

Node標準テストで、対象PRの条件、古いhead・run・再試行、失敗・skipされたtest、不足する保護、API拒否、SHAの直前変更、報告処理、PagesのSHA照合と権限分離を検証します。外部GitHub APIの書き込みはmockで検証し、テストのために失敗PRや設定変更は作りません。導入前には `actionlint` でもワークフロー構文を検証します。
