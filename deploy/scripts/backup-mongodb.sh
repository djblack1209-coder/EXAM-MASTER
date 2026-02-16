#!/bin/bash
# ============================================
# Exam-Master MongoDB 备份脚本
# 支持全量备份和增量备份
# ============================================

set -euo pipefail

# ==================== 配置 ====================
BACKUP_DIR="${BACKUP_DIR:-/data/backups/mongodb}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/exam-master}"
BACKUP_TYPE="${1:-full}"  # full 或 incremental
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)

# 云存储配置（可选）
OSS_BUCKET="${OSS_BUCKET:-}"
S3_BUCKET="${S3_BUCKET:-}"

# 日志配置
LOG_FILE="${BACKUP_DIR}/logs/backup_${DATE}.log"

# ==================== 函数定义 ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    exit 1
}

# 检查依赖
check_dependencies() {
    log "检查依赖..."
    command -v mongodump >/dev/null 2>&1 || error "mongodump 未安装"
    command -v gzip >/dev/null 2>&1 || error "gzip 未安装"
}

# 创建备份目录
setup_directories() {
    log "创建备份目录..."
    mkdir -p "${BACKUP_DIR}/full"
    mkdir -p "${BACKUP_DIR}/incremental"
    mkdir -p "${BACKUP_DIR}/logs"
}

# 全量备份
full_backup() {
    local backup_name="exam-master-full-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/full/${backup_name}"
    
    log "开始全量备份: ${backup_name}"
    
    # 执行备份
    mongodump \
        --uri="${MONGODB_URI}" \
        --out="${backup_path}" \
        --gzip \
        2>&1 | tee -a "$LOG_FILE"
    
    # 创建压缩包
    log "压缩备份文件..."
    cd "${BACKUP_DIR}/full"
    tar -czf "${backup_name}.tar.gz" "${backup_name}"
    rm -rf "${backup_name}"
    
    # 计算校验和
    sha256sum "${backup_name}.tar.gz" > "${backup_name}.tar.gz.sha256"
    
    log "全量备份完成: ${backup_name}.tar.gz"
    echo "${backup_name}.tar.gz"
}

# 增量备份（基于 oplog）
incremental_backup() {
    local backup_name="exam-master-incr-${TIMESTAMP}"
    local backup_path="${BACKUP_DIR}/incremental/${backup_name}.archive"
    
    log "开始增量备份: ${backup_name}"
    
    # 获取上次备份的时间戳
    local last_backup_ts="${BACKUP_DIR}/.last_backup_ts"
    local start_ts=""
    
    if [[ -f "$last_backup_ts" ]]; then
        start_ts=$(cat "$last_backup_ts")
        log "从时间戳 ${start_ts} 开始增量备份"
    fi
    
    # 执行 oplog 备份
    mongodump \
        --uri="${MONGODB_URI}" \
        --archive="${backup_path}" \
        --gzip \
        --oplog \
        2>&1 | tee -a "$LOG_FILE"
    
    # 更新时间戳
    date +%s > "$last_backup_ts"
    
    # 计算校验和
    sha256sum "${backup_path}" > "${backup_path}.sha256"
    
    log "增量备份完成: ${backup_name}.archive"
    echo "${backup_name}.archive"
}

# 上传到云存储
upload_to_cloud() {
    local backup_file="$1"
    local backup_path="${BACKUP_DIR}/${BACKUP_TYPE}/${backup_file}"
    
    # 上传到阿里云 OSS
    if [[ -n "$OSS_BUCKET" ]]; then
        log "上传到阿里云 OSS: ${OSS_BUCKET}"
        ossutil cp "${backup_path}" "oss://${OSS_BUCKET}/mongodb/${DATE}/" \
            2>&1 | tee -a "$LOG_FILE" || log "OSS 上传失败"
    fi
    
    # 上传到 AWS S3
    if [[ -n "$S3_BUCKET" ]]; then
        log "上传到 AWS S3: ${S3_BUCKET}"
        aws s3 cp "${backup_path}" "s3://${S3_BUCKET}/mongodb/${DATE}/" \
            2>&1 | tee -a "$LOG_FILE" || log "S3 上传失败"
    fi
}

# 清理过期备份
cleanup_old_backups() {
    log "清理 ${RETENTION_DAYS} 天前的备份..."
    
    # 清理本地备份
    find "${BACKUP_DIR}/full" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find "${BACKUP_DIR}/full" -name "*.sha256" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find "${BACKUP_DIR}/incremental" -name "*.archive" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find "${BACKUP_DIR}/incremental" -name "*.sha256" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find "${BACKUP_DIR}/logs" -name "*.log" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    log "清理完成"
}

# 验证备份
verify_backup() {
    local backup_file="$1"
    local backup_path="${BACKUP_DIR}/${BACKUP_TYPE}/${backup_file}"
    
    log "验证备份文件完整性..."
    
    if [[ -f "${backup_path}.sha256" ]]; then
        cd "$(dirname "${backup_path}")"
        if sha256sum -c "$(basename "${backup_path}").sha256" 2>/dev/null; then
            log "备份验证通过"
            return 0
        else
            error "备份验证失败"
        fi
    else
        log "警告: 未找到校验和文件"
    fi
}

# 发送通知
send_notification() {
    local status="$1"
    local message="$2"
    
    # 企业微信通知
    if [[ -n "${WECHAT_WEBHOOK:-}" ]]; then
        curl -s -X POST "${WECHAT_WEBHOOK}" \
            -H 'Content-Type: application/json' \
            -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"[Exam-Master 备份] ${status}: ${message}\"}}" \
            >/dev/null 2>&1 || true
    fi
}

# ==================== 主流程 ====================

main() {
    log "=========================================="
    log "Exam-Master MongoDB 备份开始"
    log "备份类型: ${BACKUP_TYPE}"
    log "=========================================="
    
    check_dependencies
    setup_directories
    
    local backup_file=""
    
    case "$BACKUP_TYPE" in
        full)
            backup_file=$(full_backup)
            ;;
        incremental)
            backup_file=$(incremental_backup)
            ;;
        *)
            error "未知的备份类型: ${BACKUP_TYPE}"
            ;;
    esac
    
    verify_backup "$backup_file"
    upload_to_cloud "$backup_file"
    cleanup_old_backups
    
    log "=========================================="
    log "备份完成: ${backup_file}"
    log "=========================================="
    
    send_notification "成功" "备份文件: ${backup_file}"
}

# 错误处理
trap 'send_notification "失败" "备份过程中发生错误，请检查日志"' ERR

main "$@"
