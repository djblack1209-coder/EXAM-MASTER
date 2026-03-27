/**
 * markdown-it 微信小程序降级 shim
 * 提供基础 Markdown → HTML 转换（不含完整插件系统）
 * H5 端不受影响（此 shim 仅在 mp-* 构建时替换真实 markdown-it）
 */
class MarkdownItLite {
  constructor() {}
  use() {
    return this;
  }
  render(src) {
    if (!src) return '';
    let html = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // 粗体/斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">$1</code>');
    // 代码块
    html = html.replace(/```[\s\S]*?```/g, function (match) {
      const code = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      return (
        '<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto"><code>' +
        code +
        '</code></pre>'
      );
    });
    // 列表
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    // 换行
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }
}
export default MarkdownItLite;
