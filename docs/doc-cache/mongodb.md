# MongoDB 文档摘要缓存

> 项目版本：MongoDB 7.x | Node Driver 最新

## $or 查询必须用顶层 .where()

- **来源**：项目已知坑 + https://www.mongodb.com/zh-cn/docs/manual/reference/operator/query/or/
- **结论**：在本项目的 MongoDB 查询中，`$or` 操作符必须通过 `.where()` 在顶层使用，不能嵌套在其他查询条件内部。错误用法会导致查询结果不正确且不报错。
- **日期**：2026-03-29

## aggregation pipeline $match 阶段放在最前面

- **来源**：https://www.mongodb.com/zh-cn/docs/manual/core/aggregation-pipeline-optimization/
- **结论**：`$match` 尽量放在 pipeline 最前面，可以利用索引加速。`$match` 放在 `$project` 或 `$group` 后面无法利用索引。
- **日期**：2026-03-29
