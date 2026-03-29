# TypeScript 文档摘要缓存

> 项目版本：TypeScript 5.x | Node.js >=20.17.0

## tsconfig.json 关键配置项

- **来源**：https://www.typescriptlang.org/tsconfig
- **结论**：本项目后端使用 `tsconfig.standalone.json`，编译命令：`npx tsc --project tsconfig.standalone.json`。注意 `moduleResolution` 要与 `module` 配套（`node16` 配 `node16`，`bundler` 配 `esnext`）。
- **日期**：2026-03-29

## 常用工具类型

- **来源**：https://www.typescriptlang.org/docs/handbook/utility-types.html
- **结论**：`Partial<T>` 所有属性可选，`Required<T>` 所有属性必填，`Pick<T, K>` 选取部分属性，`Omit<T, K>` 排除部分属性，`Record<K, V>` 键值对映射。这些在后端云函数中频繁使用。
- **日期**：2026-03-29

## async/await 错误处理

- **来源**：https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html
- **结论**：TS 4.0+ 的 catch 子句变量默认是 `unknown` 类型（不是 `any`）。必须先 `if (error instanceof Error)` 判断类型后才能访问 `.message` 等属性。
- **日期**：2026-03-29
