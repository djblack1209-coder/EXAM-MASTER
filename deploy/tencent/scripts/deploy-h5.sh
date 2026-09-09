#!/usr/bin/env bash
# Local build entrypoint. Production deployment remains closed until the owning
# release transaction verifies local recovery and an independent rollback worker.
set -euo pipefail

usage() {
    echo '用法：bash deploy/tencent/scripts/deploy-h5.sh --build-only'
    echo '仅构建本地候选；无参数调用和生产发布均返回非零状态。'
}

if (( $# == 1 )) && [[ "$1" == '--help' || "$1" == '-h' ]]; then
    usage
    exit 0
fi
if (( $# == 0 )); then
    echo 'BLOCKED_RECOVERY_NOT_PROVEN：旧入口缺少本地恢复验证、原子应用与独立自动回滚。' >&2
    echo 'BLOCKED_BUSINESS_DATA_NOT_VERIFIED：业务数据可用性须单独验收，浅层 HTTP 200 不构成发布依据。' >&2
    echo '本地候选构建请使用 --build-only；构建成功不表示已发布。' >&2
    exit 78
fi
if (( $# != 1 )) || [[ "$1" != '--build-only' ]]; then
    usage >&2
    exit 64
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
(cd "$ROOT/" && npm run build:h5)
[[ -s "$ROOT/dist/build/h5/index.html" ]] || { echo "构建产物缺失：dist/build/h5/index.html" >&2; exit 1; }
echo '本地候选构建通过；未发布到生产。'
