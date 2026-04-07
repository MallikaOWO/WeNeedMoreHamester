#!/bin/bash
# 鼠鼠天堂 发行版构建脚本
# 用法: bash release.sh <卡版本> <预设版本> [更新日志]
# 示例: bash release.sh 0.6.0 0.1.0 "新增自动更新功能"

set -e

CARD_VER="${1:?请指定角色卡版本号，如: bash release.sh 0.6.0 0.1.0}"
PRESET_VER="${2:?请指定预设版本号，如: bash release.sh 0.6.0 0.1.0}"
CHANGELOG="${3:-}"

YAML_FILE="鼠鼠天堂/鼠鼠天堂.yaml"
CDN_OLD="cdn.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/"
CDN_NEW="cdn.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/${CARD_VER}/"

echo "=== 鼠鼠天堂 发行版构建 ==="
echo "角色卡版本: v${CARD_VER}"
echo "预设版本:   v${PRESET_VER}"
echo ""

# 1. 更新 manifest.json
echo "[1/6] 更新 manifest.json..."
python3 -X utf8 -c "
import json, sys, datetime
ver = '${CARD_VER}'
changelog = '''${CHANGELOG}'''
with open('manifest.json', 'r', encoding='utf-8') as f:
    m = json.load(f)
# 如果该版本已存在则更新，否则插入
existing = next((v for v in m['versions'] if v['version'] == ver), None)
entry = {
    'version': ver,
    'date': datetime.date.today().isoformat(),
    'changelog': changelog or (existing['changelog'] if existing else ''),
    'path': f'release_src/\u53d1\u884c\u89d2\u8272\u5361/\u9f20\u9f20\u5929\u5802_v{ver}.png'
}
if existing:
    idx = m['versions'].index(existing)
    m['versions'][idx] = entry
else:
    m['versions'].insert(0, entry)
m['latest'] = ver
with open('manifest.json', 'w', encoding='utf-8') as f:
    json.dump(m, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(f'  latest: {ver}')
if not changelog and not existing:
    print('  \u26a0 \u672a\u63d0\u4f9b\u66f4\u65b0\u65e5\u5fd7\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u7f16\u8f91 manifest.json')
"

# 2. 构建前端（带版本号）
echo "[2/6] 构建前端 (dist/${CARD_VER}/)..."
pnpm build --env version="${CARD_VER}"

# 3. 临时替换 yaml 中的版本号和 CDN 路径
echo "[3/6] 临时替换版本号和 CDN 路径..."
cp "${YAML_FILE}" "${YAML_FILE}.bak"
# 更新版本字段
sed -i "s|^版本: .*|版本: ${CARD_VER}|" "${YAML_FILE}"
# 更新备注中的版本号（鼠鼠天堂 vX.Y.Z）
sed -i "s|鼠鼠天堂 v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*|鼠鼠天堂 v${CARD_VER}|g" "${YAML_FILE}"
# 更新备注中的预设版本号
sed -i "s|配套预设版本: [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*|配套预设版本: ${PRESET_VER}|" "${YAML_FILE}"
# 替换 CDN 路径
sed -i "s|${CDN_OLD}|${CDN_NEW}|g" "${YAML_FILE}"
echo "  版本: ${CARD_VER} | 预设: ${PRESET_VER}"
echo "  ${CDN_OLD} → ${CDN_NEW}"

# 4. 打包
echo "[4/6] 打包角色卡和预设..."
node tavern_sync.mjs bundle 鼠鼠天堂
node tavern_sync.mjs bundle 空白预设

# 5. 还原 yaml
echo "[5/6] 还原开发版 yaml..."
mv "${YAML_FILE}.bak" "${YAML_FILE}"

# 6. 复制到发行目录
echo "[6/6] 复制到发行目录..."
mkdir -p release_src/发行角色卡 release_src/发行预设
cp "release_src/鼠鼠天堂.png" "release_src/发行角色卡/鼠鼠天堂_v${CARD_VER}.png"
cp "release_src/空白预设.json" "release_src/发行预设/鼠鼠天堂预设_v${PRESET_VER}.json"

echo ""
echo "=== 构建完成 ==="
echo "  release_src/发行角色卡/鼠鼠天堂_v${CARD_VER}.png"
echo "  release_src/发行预设/鼠鼠天堂预设_v${PRESET_VER}.json"
