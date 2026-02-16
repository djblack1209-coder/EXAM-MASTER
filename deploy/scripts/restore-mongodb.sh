#!/bin/bash
# ============================================
# Exam-Master MongoDB 恢复脚本
# 支持全量恢复和时间点恢复
# ============================================

set -euo pipefail

# ==================== 配置 ====================
BACKUP_DIR="${BACKUP_DIR:-/data/backups/mongodb}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/exam-master}"
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
    command -v tar >/dev/null 2>&1 || error "tar 未安装"
}

# 列出可用备份
list_backups() {
    log "可用的全量备份:"
    ls -la "${BACKUP_DIR}/full/"*.tar.gz 2>/dev/null || log "  无全量备份"
    
    log ""
    log "可用的增量备份:"
    ls -la "${BACKUP_DIR}/incremental/"*.archive 2>/dev/null || log "  无增量备份"
}

# 验证备份文件
verify_backup() {
    local backup_path="$1"
    
    log "验证备份文件: ${backup_path}"
    
    if [[ ! -f "$backup_path" ]]; then
        error "备份文件不存在: ${backup_path}"
    fi
    
    # 检查校验和
    if [[ -f "${backup_path}.sha256" ]]; then
        cd "$(dirname "${backup_path}")"
        if sha256sum -c "$(basename "${backup_path}").sha256" 2>/dev/null; then
            log "备份文件校验通过"
        else
            error "备份文件校验失败"
        fi
    else
        log "警告: 未找到校验和文件，跳过验证"
    fi
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
    
    # 创建临时目录
    local temp_dir=$(mktemp -d)
    trap "rm -rf ${temp_dir}" EXIT
    
    # 解压备份
    log "解压备份文件..."
    tar -xzf "$backup_path" -C "$temp_dir"
    
    # 获取解压后的目录名
    local restore_dir=$(ls "$temp_dir")
    
    # 确认恢复操作
    confirm "警告: 此操作将覆盖现有数据库。是否继续?"
    
    # 执行恢复
    log "执行数据库恢复..."
    mongorestore \
        --uri="${MONGODB_URI}" \
        --drop \
        --gzip \
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
    local collections=$(mongosh "${MONGODB_URI}" --quiet --eval "db.getCollectionNames().length")
    log "恢复后集合数量: ${collections}"
    
    # 检查文档数量
    local users=$(mongosh "${MONGODB_URI}" --quiet --eval "db.users.countDocuments()")
    local questions=$(mongosh "${MONGODB_URI}" --quiet --eval "db.questions.countDocuments()")
    
    log "用户数量: ${users}"
    log "题目数量: ${questions}"
    
    log "恢复后验证完成"
}

# 显示帮助
show_help() {
    cat << EOF
Exam-Master MongoDB 恢复脚本

用法:
    $0 <restore_type> [backup_file] [target_time]

恢复类型:
    list            列出所有可用备份
    full            全量恢复
    incremental     增量恢复
    point-in-time   时间点恢复

示例:
    $0 list
    $0 full exam-master-full-20260127_030000.tar.gz
    $0 incremental exam-master-incr-20260127_040000.archive
    $0 point-in-time exam-master-full-20260127_030000.tar.gz "2026-01-27 05:00:00"

环境变量:
    BACKUP_DIR      备份目录 (默认: /data/backups/mongodb)
    MONGODB_URI     MongoDB 连接字符串
EOF
}

# ==================== 主流程 ====================

main() {
    mkdir -p "${BACKUP_DIR}/logs"
    
    log "=========================================="
    log "Exam-Master MongoDB 恢复开始"
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
