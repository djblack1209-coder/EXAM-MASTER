#!/bin/bash
# ============================================
# Yozi AI MongoDB 恢复脚本
# 支持全量恢复和时间点恢复
# ============================================

set -euo pipefail
umask 077

# ==================== 配置 ====================
BACKUP_DIR="${BACKUP_DIR:-/data/backups/mongodb}"
MONGODB_URI="${MONGODB_URI:-}"
RESTORE_TYPE="${1:-full}"  # full, point-in-time
BACKUP_FILE="${2:-}"       # 备份文件名
TARGET_TIME="${3:-}"       # 目标恢复时间点（可选）

# 日志配置
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/logs/restore_${TIMESTAMP}.log"

# ==================== 函数定义 ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    exit 1
}

confirm() {
    read -p "$1 [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "操作已取消"
        exit 0
    fi
}

# 检查依赖
check_dependencies() {
    log "检查依赖..."
    command -v mongorestore >/dev/null 2>&1 || error "mongorestore 未安装"
    command -v mongosh >/dev/null 2>&1 || error "mongosh 未安装"
    command -v python3 >/dev/null 2>&1 || error "python3 未安装"
}

# 列出可用备份
list_backups() {
    local file found=0
    printf '可用的全量备份（原生 archive / 历史 tar.gz）:\n'
    for file in "${BACKUP_DIR}/full/"*.archive "${BACKUP_DIR}/full/"*.tar.gz; do
        [[ -f "$file" ]] || continue
        printf '%s\n' "$file"; found=1
    done
    [[ "$found" -eq 1 ]] || printf '  无全量备份\n'
    printf '\n可用的增量备份:\n'
    found=0
    for file in "${BACKUP_DIR}/incremental/"*.archive; do
        [[ -f "$file" ]] || continue
        printf '%s\n' "$file"; found=1
    done
    [[ "$found" -eq 1 ]] || printf '  无增量备份\n'
}

# 验证备份文件
verify_backup() {
    local backup_path="$1"
    
    log "验证备份文件: ${backup_path}"
    
    if [[ ! -f "$backup_path" ]]; then
        error "备份文件不存在: ${backup_path}"
    fi
    
    # Bind the checksum to this exact input without changing cwd. Missing
    # checksums and checksums for a different filename must fail closed.
    if ! python3 - "$backup_path" <<'PY'
import hashlib
from pathlib import Path
import re
import sys

try:
    path = Path(sys.argv[1])
    checksum = Path(str(path) + '.sha256')
    if path.is_symlink() or checksum.is_symlink() or not path.is_file() or not checksum.is_file():
        raise ValueError('missing regular backup/checksum')
    match = re.fullmatch(r'([0-9a-fA-F]{64}) [ *](.+)', checksum.read_text().strip())
    if match is None or match[2] != path.name or path.stat().st_size == 0:
        raise ValueError('checksum does not identify the backup')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != match[1].lower():
        raise ValueError('backup checksum differs')
except (OSError, ValueError):
    raise SystemExit(1)
PY
    then
        error "备份或同名 SHA-256 校验文件缺失、不匹配或不是普通文件"
    fi
    log "备份文件校验通过"
}

# 全量恢复
full_restore() {
    local backup_file="$1"
    local backup_path=""
    
    # 确定备份文件路径
    if [[ -f "${BACKUP_DIR}/full/${backup_file}" ]]; then
        backup_path="${BACKUP_DIR}/full/${backup_file}"
    elif [[ -f "$backup_file" ]]; then
        backup_path="$backup_file"
    else
        error "找不到备份文件: ${backup_file}"
    fi
    
    verify_backup "$backup_path"
    
    log "开始全量恢复: ${backup_path}"

    # backup-mongodb.sh produces a gzip-compressed mongodump archive, not tar.
    if [[ "$backup_path" == *.archive ]]; then
        confirm "警告: 此操作将覆盖现有数据库。是否继续?"
        mongorestore --uri="${MONGODB_URI}" --drop --gzip \
            --stopOnError --archive="$backup_path" 2>&1 | tee -a "$LOG_FILE"
        log "全量恢复完成"
        return
    fi
    [[ "$backup_path" == *.tar.gz ]] || error "不支持的全量备份格式"
    
    # 创建临时目录
    local temp_dir
    temp_dir=$(mktemp -d) || error "无法创建隔离恢复目录"
    RESTORE_TEMP_DIR="$temp_dir"
    trap 'rm -rf -- "${RESTORE_TEMP_DIR:-}"' EXIT
    
    # 解压备份
    log "解压备份文件..."
    local restore_dir
    restore_dir=$(python3 - "$backup_path" "$temp_dir" <<'PY'
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile

try:
    destination = Path(sys.argv[2])
    with tarfile.open(sys.argv[1], 'r:gz') as archive:
        members = archive.getmembers()
        names = set()
        roots = set()
        bson_found = False
        for member in members:
            name = PurePosixPath(member.name)
            if (not name.parts or name.is_absolute() or '..' in name.parts
                    or any(ord(c) < 32 for c in member.name)
                    or not (member.isfile() or member.isdir()) or name in names):
                raise ValueError('unsafe or duplicate archive member')
            names.add(name)
            roots.add(name.parts[0])
            bson_found |= member.isfile() and member.name.endswith(('.bson', '.bson.gz'))
        if len(roots) != 1 or not bson_found:
            raise ValueError('expected one BSON dump root')
        for member in members:
            target = destination / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.extractfile(member) as source, target.open('xb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o600)
                if target.stat().st_size != member.size:
                    raise ValueError('incomplete archive member')
        print(next(iter(roots)))
except (OSError, ValueError, tarfile.TarError):
    raise SystemExit(1)
PY
    ) || error "历史备份不是单根 BSON 归档或包含不安全成员"
    
    # 确认恢复操作
    confirm "警告: 此操作将覆盖现有数据库。是否继续?"
    
    # 执行恢复
    log "执行数据库恢复..."
    mongorestore \
        --uri="${MONGODB_URI}" \
        --drop \
        --gzip \
        --stopOnError \
        "${temp_dir}/${restore_dir}" \
        2>&1 | tee -a "$LOG_FILE"
    
    log "全量恢复完成"
}

# 增量恢复
incremental_restore() {
    local backup_file="$1"
    local backup_path=""
    
    # 确定备份文件路径
    if [[ -f "${BACKUP_DIR}/incremental/${backup_file}" ]]; then
        backup_path="${BACKUP_DIR}/incremental/${backup_file}"
    elif [[ -f "$backup_file" ]]; then
        backup_path="$backup_file"
    else
        error "找不到备份文件: ${backup_file}"
    fi
    
    verify_backup "$backup_path"
    
    log "开始增量恢复: ${backup_path}"
    
    # 确认恢复操作
    confirm "警告: 此操作将应用增量备份。是否继续?"
    
    # 执行恢复
    mongorestore \
        --uri="${MONGODB_URI}" \
        --archive="$backup_path" \
        --gzip \
        --oplogReplay \
        2>&1 | tee -a "$LOG_FILE"
    
    log "增量恢复完成"
}

# 时间点恢复
point_in_time_restore() {
    local full_backup="$1"
    local target_time="$2"
    
    log "开始时间点恢复"
    log "全量备份: ${full_backup}"
    log "目标时间: ${target_time}"
    
    # 首先恢复全量备份
    full_restore "$full_backup"
    
    # 然后应用增量备份直到目标时间点
    log "应用增量备份..."
    
    for incr_backup in "${BACKUP_DIR}/incremental/"*.archive; do
        if [[ -f "$incr_backup" ]]; then
            # 检查备份时间是否在目标时间之前
            local backup_time=$(stat -c %Y "$incr_backup" 2>/dev/null || stat -f %m "$incr_backup")
            local target_ts=$(date -d "$target_time" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$target_time" +%s)
            
            if [[ $backup_time -le $target_ts ]]; then
                log "应用增量备份: $(basename "$incr_backup")"
                mongorestore \
                    --uri="${MONGODB_URI}" \
                    --archive="$incr_backup" \
                    --gzip \
                    --oplogReplay \
                    --oplogLimit="$target_ts:0" \
                    2>&1 | tee -a "$LOG_FILE"
            fi
        fi
    done
    
    log "时间点恢复完成"
}

# 恢复前检查
pre_restore_check() {
    log "执行恢复前检查..."
    [[ -n "$MONGODB_URI" ]] || error "必须显式设置 MONGODB_URI，禁止默认连接本地数据库"
    
    # 检查 MongoDB 连接
    if ! mongosh "${MONGODB_URI}" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        error "无法连接到 MongoDB"
    fi
    
    # 检查磁盘空间
    local available_space=$(df -BG "${BACKUP_DIR}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ $available_space -lt 10 ]]; then
        log "警告: 可用磁盘空间不足 10GB"
    fi
    
    log "恢复前检查通过"
}

# 恢复后验证
post_restore_verify() {
    log "执行恢复后验证..."
    
    # 检查集合数量
    local collections users questions
    collections=$(mongosh "${MONGODB_URI}" --quiet --eval "db.getCollectionNames().length") || error "恢复后集合检查失败"
    log "恢复后集合数量: ${collections}"
    
    # 检查文档数量
    users=$(mongosh "${MONGODB_URI}" --quiet --eval "db.users.countDocuments()") || error "恢复后用户集合检查失败"
    questions=$(mongosh "${MONGODB_URI}" --quiet --eval "db.questions.countDocuments()") || error "恢复后题目集合检查失败"
    [[ "$collections" =~ ^[0-9]+$ && "$users" =~ ^[0-9]+$ && "$questions" =~ ^[0-9]+$ ]] || error "恢复后集合统计不是有效计数"
    
    log "用户数量: ${users}"
    log "题目数量: ${questions}"
    
    log "恢复后验证完成"
}

# 显示帮助
show_help() {
    cat << EOF
Yozi AI MongoDB 恢复脚本

用法:
    $0 <restore_type> [backup_file] [target_time]

恢复类型:
    list            列出所有可用备份
    full            全量恢复
    incremental     增量恢复
    point-in-time   时间点恢复

示例:
    $0 list
    $0 full exam-master-full-20260127_030000.archive
    $0 incremental exam-master-incr-20260127_040000.archive
    $0 point-in-time exam-master-full-20260127_030000.archive "2026-01-27 05:00:00"

环境变量:
    BACKUP_DIR      备份目录 (默认: /data/backups/mongodb)
    MONGODB_URI     MongoDB 连接字符串（写入前必须显式设置）

全量恢复支持原生 .archive 与历史单根 BSON .tar.gz，必须附带同名 .sha256。
此脚本不提供独立生产自动回滚；生产恢复仍须所属运维事务及真实业务验收。
EOF
}

# ==================== 主流程 ====================

main() {
    # Metadata discovery needs neither database tools nor log/directory writes.
    case "$RESTORE_TYPE" in
        list) list_backups; return ;;
        help|--help|-h) show_help; return ;;
    esac
    mkdir -p "${BACKUP_DIR}/logs"
    
    log "=========================================="
    log "Yozi AI MongoDB 恢复开始"
    log "恢复类型: ${RESTORE_TYPE}"
    log "=========================================="
    
    check_dependencies
    
    case "$RESTORE_TYPE" in
        list)
            list_backups
            ;;
        full)
            if [[ -z "$BACKUP_FILE" ]]; then
                error "请指定备份文件"
            fi
            pre_restore_check
            full_restore "$BACKUP_FILE"
            post_restore_verify
            ;;
        incremental)
            if [[ -z "$BACKUP_FILE" ]]; then
                error "请指定备份文件"
            fi
            pre_restore_check
            incremental_restore "$BACKUP_FILE"
            post_restore_verify
            ;;
        point-in-time)
            if [[ -z "$BACKUP_FILE" ]] || [[ -z "$TARGET_TIME" ]]; then
                error "请指定备份文件和目标时间"
            fi
            pre_restore_check
            point_in_time_restore "$BACKUP_FILE" "$TARGET_TIME"
            post_restore_verify
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "未知的恢复类型: ${RESTORE_TYPE}"
            ;;
    esac
    
    log "=========================================="
    log "恢复操作完成"
    log "=========================================="
}

main "$@"
