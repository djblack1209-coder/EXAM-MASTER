// Hand-authored synthetic questions, exclusively for engine tests, never product content.
const subject = 'math-engine-fixture';
const rows = [
  ['integer', '整数加法', '3 + 4 = ?', ['7', '8'], 0, '2 + 1 = ?', ['3', '4'], 0],
  ['multiply', '乘法', '3 × 4 = ?', ['12', '7'], 0, '2 × 2 = ?', ['4', '3'], 0],
  ['divide', '除法', '12 ÷ 3 = ?', ['4', '3'], 0, '4 ÷ 2 = ?', ['2', '1'], 0],
  ['fraction', '分数含义', '一半用分数表示为？', ['1/2', '2/1'], 0, '二等分取一份表示？', ['1/2', '1/3'], 0],
  ['common-denom', '通分', '1/2 与 1/3 的最小公分母？', ['6', '5'], 0, '1/2 的等值分数？', ['2/4', '1/4'], 0],
  ['fraction-add', '分数加法', '1/2 + 1/3 = ?', ['5/6', '2/5'], 0, '1/4 + 1/4 = ?', ['1/2', '1/8'], 0],
  ['linear', '一次式合并', 'x/2 + x/3 = ?', ['5x/6', '2x/5'], 0, 'x/4 + x/4 = ?', ['x/2', 'x/8'], 0],
  ['equation', '一次方程', 'x/2 + x/3 = 5，x = ?', ['6', '5'], 0, 'x/2 = 3，x = ?', ['6', '3'], 0],
  ['ratio', '比的表示', '2 比 3 的写法？', ['2:3', '3:2'], 0, '1 比 2 的写法？', ['1:2', '2:1'], 0]
];

export function mathGraphFixture() {
  return {
    version: 'test-only-v1',
    subject,
    topics: rows.map(([id, name, prompt, options, answerIndex, lowerPrompt, lowerOptions, lowerIndex]) => ({
      id,
      name,
      subject,
      type: 'procedural',
      masteryCriteria: ['独立计算或判断正确'],
      diagnostic: {
        prompt,
        kind: 'choice',
        options: [...options],
        answerIndex,
        lowered: { prompt: lowerPrompt, kind: 'choice', options: [...lowerOptions], answerIndex: lowerIndex }
      }
    })),
    edges: [
      ['integer', 'multiply'],
      ['multiply', 'divide'],
      ['divide', 'fraction'],
      ['fraction', 'common-denom'],
      ['common-denom', 'fraction-add'],
      ['fraction-add', 'linear'],
      ['linear', 'equation']
    ]
      .map(([from, to]) => ({ from, to, strength: 'hard' }))
      .concat([{ from: 'ratio', to: 'equation', strength: 'soft', reason: '仅为提示关系' }])
  };
}
