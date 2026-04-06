#!/bin/bash
# 鼠鼠天堂 发行版构建脚本
# 用法: bash release.sh <卡版本> <预设版本>
# 示例: bash release.sh 0.5.0 0.1.0

set -e

CARD_VER="${1:?请指定角色卡版本号，如: bash release.sh 0.5.0 0.1.0}"
PRESET_VER="${2:?请指定预设版本号，如: bash release.sh 0.5.0 0.1.0}"

YAML_FILE="鼠鼠天堂/鼠鼠天堂.yaml"
CDN_OLD="cdn.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/"
CDN_NEW="cdn.jsdelivr.net/gh/MallikaOWO/WeNeedMoreHamester/dist/${CARD_VER}/"

echo "=== 鼠鼠天堂 发行版构建 ==="
echo "角色卡版本: v${CARD_VER}"
echo "预设版本:   v${PRESET_VER}"
echo ""

# 1. 构建前端（带版本号）
echo "[1/5] 构建前端 (dist/${CARD_VER}/)..."
pnpm build --env version="${CARD_VER}"

# 2. 临时替换 yaml 中的 CDN 路径
echo "[2/5] 临时替换 CDN 路径..."
cp "${YAML_FILE}" "${YAML_FILE}.bak"
sed -i "s|${CDN_OLD}|${CDN_NEW}|g" "${YAML_FILE}"
echo "  ${CDN_OLD} → ${CDN_NEW}"

# 3. 打包
echo "[3/5] 打包角色卡和预设..."
node tavern_sync.mjs bundle 鼠鼠天堂
node tavern_sync.mjs bundle 空白预设

# 4. 还原 yaml
echo "[4/5] 还原开发版 yaml..."
mv "${YAML_FILE}.bak" "${YAML_FILE}"

# 5. 复制到发行目录
echo "[5/5] 复制到发行目录..."
mkdir -p release_src/发行角色卡 release_src/发行预设
cp "release_src/鼠鼠天堂.png" "release_src/发行角色卡/鼠鼠天堂_v${CARD_VER}.png"
cp "release_src/空白预设.json" "release_src/发行预设/鼠鼠天堂预设_v${PRESET_VER}.json"

echo ""
echo "=== 构建完成 ==="
echo "  release_src/发行角色卡/鼠鼠天堂_v${CARD_VER}.png"
echo "  release_src/发行预设/鼠鼠天堂预设_v${PRESET_VER}.json"
