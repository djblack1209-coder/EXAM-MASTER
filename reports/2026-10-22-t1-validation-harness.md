# T1 多学科诊断验证工具

结论：验证包 schema、指标计算与 CLI 已落地；合成 fixture 只验证数学口径，`real_effect` 明确为 `unavailable`。没有真实教师根因、盲评或 408 重放包，不输出 ≥80% 或任何真实准确率。

## 交付

- [diagnosis-validation.schema.json](../scripts/eval/diagnosis-validation.schema.json)：学科/版本/来源、Q 矩阵属性、题目（答案/属性/主测或降阶/审核）、轨迹（匿名学生、作答、提示、轮次）、专家根因与双评裁决、模型预测。
- [diagnosis-validation.mjs](../scripts/eval/diagnosis-validation.mjs)：
  - `--validate` 只校验包；缺 gold/来源/审核人时 `package_status=incomplete` 并拒绝输出准确率。
  - 根因准确率按多标签集合比较；`gold_insufficient`、`missing_prediction`、`abstained` 单列，不计入正确/错误。
  - 掌握分类一致性、Q 矩阵复核率；未知分母/null 显式。
  - 输出 `real_effect: unavailable`，不把合成 fixture 当真实效度。
- [synthetic fixture](../tests/fixtures/evaluation/diagnosis-validation.synthetic.json)：5 条合成轨迹，覆盖多标签、证据不足、缺预测；仅算术验证。
- 运行：`node scripts/eval/diagnosis-validation.mjs --package tests/fixtures/evaluation/diagnosis-validation.synthetic.json`；只读校验加 `--validate`。

## 已核对

- `--validate` 退出 0，`package_status=complete`，`real_effect=unavailable`。
- 合成指标：gold_eligible 4、gold_insufficient 1、missing_prediction 1、compared 3、numerator 2、denominator 4；这是 fixture 算术，不是真实诊断准确率。
- 未调用模型、未写账户数据、未加依赖、未改主包。

## 真实验证仍缺

- 408 脱敏重放包：原资料、题面、提示、原答、模型原始响应。
- 四科教师独立答案/先修/根因标注与双人盲评；管综 199、高考语文可用题源。
- 数学/英语真题的公式/答案人工校对。
- 没有这些，T1 只能保持工具与合成回归，不能标为真实通过。
