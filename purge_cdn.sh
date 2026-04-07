#!/bin/bash
# jsdelivr CDN 缓存清除脚本
# 用法: bash purge_cdn.sh [版本号]
# 示例: bash purge_cdn.sh          — 清除默认路径 (dist/鼠鼠天堂/...)
#       bash purge_cdn.sh 0.6.0    — 清除版本路径 (dist/0.6.0/鼠鼠天堂/...)

set -e

VERSION="${1:-}"

python3 -X utf8 -c "
import urllib.parse, urllib.request, json, sys

version = '$VERSION'
base = 'https://purge.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester'
prefix = f'dist/{version}/\u9f20\u9f20\u5929\u5802' if version else 'dist/\u9f20\u9f20\u5929\u5802'

paths = [
    f'{prefix}/\u754c\u9762/\u4e3b\u754c\u9762/index.html',
    f'{prefix}/\u754c\u9762/\u4e3b\u754c\u9762/index.js',
    f'{prefix}/\u811a\u672c/\u81ea\u52a8\u66f4\u65b0/index.js',
    f'{prefix}/\u811a\u672c/\u53d8\u91cf\u7ed3\u6784/index.js',
    f'{prefix}/\u811a\u672c/\u9690\u85cf\u697c\u5c42/index.js',
]

tag = f'v{version}' if version else '\u9ed8\u8ba4\u8def\u5f84'
print(f'=== \u6e05\u9664 CDN \u7f13\u5b58 ({tag}) ===')

failed = 0
for p in paths:
    encoded = urllib.parse.quote(p, safe='/')
    url = f'{base}/{encoded}'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            status = data.get('status', 'unknown')
            print(f'  OK [{status}] {p}')
    except Exception as e:
        print(f'  FAIL {p}: {e}')
        failed += 1

print()
print('=== \u6e05\u9664\u5b8c\u6210 ===' if not failed else f'=== {failed} \u4e2a\u6587\u4ef6\u5931\u8d25 ===')
sys.exit(1 if failed else 0)
"
