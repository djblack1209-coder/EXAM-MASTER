import { describe, it, expect } from 'vitest';
import {
  inspectPageImage,
  validateVisualInput,
  validateVisualReading,
  normalizeSavedVisualReading,
  visualReadingText
} from '../../laf-backend/functions/_shared/learning-vision.js';
import {
  parseVisualOutput,
  buildLearningRequest
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
import { PAGE_PNG, PAGE_SOURCE, PAGE_READING } from '../fixtures/learning-vision.js';
const question = { questionKey: 'private-q@1', source: { ...PAGE_SOURCE, kind: 'private_material' } };
describe('页图边界、来源和待校对输出', () => {
  it('只接受有本次授权、精确来源的一张真实格式头部页图', () => {
    expect(validateVisualInput([{ dataUrl: PAGE_PNG, source: PAGE_SOURCE }], true, question)).toMatchObject({
      mime: 'png',
      width: 1,
      height: 1
    });
    expect(() => validateVisualInput([{ dataUrl: PAGE_PNG, source: PAGE_SOURCE }], false, question)).toThrow(
      '单独授权'
    );
    expect(() =>
      validateVisualInput([{ dataUrl: PAGE_PNG, source: PAGE_SOURCE }], true, {
        ...question,
        source: { ...question.source, extractionEventId: 'changed' }
      })
    ).toThrow('不一致');
    expect(() => validateVisualInput([], true, question)).toThrow('一张');
    expect(() =>
      validateVisualInput(
        [{ dataUrl: PAGE_PNG, source: { ...PAGE_SOURCE, endpoint: 'http://localhost' } }],
        true,
        question
      )
    ).toThrow('来源');
  });
  it.each(
    [
      'http://169.254.169.254/latest/meta-data',
      'https://provider.example/a.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,!!!!',
      PAGE_PNG.replace('png', 'jpeg'),
      PAGE_PNG + ' ',
      'data:image/png;base64,' + 'A'.repeat(800000)
    ].map((input, index) => ({ input, index }))
  )('拒绝远程、脚本、错配、异常及超限图片 $index', ({ input }) => {
    expect(() => inspectPageImage(input)).toThrow();
  });
  it('拒绝极大尺寸和不规范尾部比特；有界 JPEG 段可读取尺寸', () => {
    const bytes = Buffer.from(PAGE_PNG.split(',')[1], 'base64');
    bytes.writeUInt32BE(4097, 16);
    expect(() => inspectPageImage(`data:image/png;base64,${bytes.toString('base64')}`)).toThrow('尺寸');
    const invalid = PAGE_PNG.replace('ggg==', 'ggh==');
    expect(() => inspectPageImage(invalid)).toThrow();
    const jpeg = Buffer.from([255, 216, 255, 192, 0, 17, 8, 0, 2, 0, 3, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 255, 217, 0]);
    expect(inspectPageImage(`data:image/jpeg;base64,${jpeg.toString('base64')}`)).toMatchObject({
      width: 3,
      height: 2
    });
  });
  it('角色、疑义和区域保留为辅助候选，不允许伪造核验和越界位置', () => {
    const reading = validateVisualReading(PAGE_READING, PAGE_SOURCE);
    expect(reading).toMatchObject({ status: 'ai_assisted', source: PAGE_SOURCE });
    expect(visualReadingText(reading)).toContain('待校对纸面作答');
    expect(visualReadingText(reading)).toContain('需局部确认');
    expect(visualReadingText(reading, 'en')).toContain('Written answer pending review');
    expect(normalizeSavedVisualReading(reading, PAGE_SOURCE)).toEqual(reading);
    expect(() => validateVisualReading({ ...PAGE_READING, verified: true }, PAGE_SOURCE)).toThrow();
    expect(() =>
      validateVisualReading(
        { ...PAGE_READING, regions: [{ role: 'standard_answer', text: '20', region: null }] },
        PAGE_SOURCE
      )
    ).toThrow();
    expect(() =>
      validateVisualReading(
        { ...PAGE_READING, regions: [{ role: 'question', text: '题目', region: [0.9, 0, 0.5, 1] }] },
        PAGE_SOURCE
      )
    ).toThrow();
    expect(() => normalizeSavedVisualReading({ ...reading, status: 'verified' }, PAGE_SOURCE)).toThrow();
  });
  it('结构化图片输出不能触发工具、题目写入或自由文本成功宣称', () => {
    const parsed = parseVisualOutput(
      JSON.stringify({ message: '已经加入错题', visualReading: PAGE_READING }),
      PAGE_SOURCE
    );
    expect(parsed.message).not.toContain('已经加入错题');
    expect(parsed.tools).toEqual([]);
    for (const value of [
      '已经加入错题',
      JSON.stringify({ visualReading: PAGE_READING, tools: [{ name: 'assess' }] }),
      JSON.stringify({ visualReading: PAGE_READING, question: { prompt: '新的题' } })
    ])
      expect(() => parseVisualOutput(value, PAGE_SOURCE)).toThrow('校验');
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: '解读当前页图' },
          { type: 'image_url', image_url: { url: PAGE_PNG } }
        ]
      }
    ];
    expect(
      buildLearningRequest(
        {
          endpoint: 'https://provider.example/chat/completions',
          model: 'explicit',
          maxOutput: 1000,
          capabilities: { structured: false }
        },
        messages
      ).messages
    ).toEqual(messages);
  });
});
