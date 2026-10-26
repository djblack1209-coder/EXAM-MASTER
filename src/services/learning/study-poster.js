import { dayKey } from './learning-domain.js';
import { museLearningInsights } from './muse-learning-insights.js';
import { reminderInstant } from '../../../laf-backend/functions/_shared/learning-reminders.js';

export const POSTER_SIZE = Object.freeze({ width: 360, height: 480, scale: 3 });
const clean = (value, size) =>
  [
    ...String(value || '')
      .replace(/[\u0000-\u001f\u007f-\u009f]/gu, '')
      .trim()
  ]
    .slice(0, size)
    .join('');

// A public-facing projection only: no names, account identifiers, documents,
// raw answers, keys or request payloads enter the image renderer.
export function studyPosterData(state, now, { day = null, observations = false } = {}) {
  const today = dayKey(now, state.timezone);
  if (
    day !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/u.test(day) ||
      !state.conversations.some(
        (item) => item.coach?.startedDay === day || item.coach?.days.some((value) => value.day === day)
      ))
  )
    throw new Error('该日期没有已保存的学习记录');
  const projected = day
    ? {
        ...state,
        conversations: state.conversations.map((item) => ({
          ...item,
          coach: item.coach
            ? {
                ...item.coach,
                diagnostic: item.coach.startedDay === day ? item.coach.diagnostic : null,
                days: item.coach.days.filter((value) => value.day === day)
              }
            : null
        }))
      }
    : state;
  const data = museLearningInsights(projected, day ? reminderInstant(day, '12:00', state.timezone) : now);
  return {
    date: day || today,
    title: day ? '这一天的学习' : '我的学习记录',
    stats: [
      { label: day ? '已提交' : '累计提交', value: data.submitted, unit: '次' },
      { label: day ? '完成训练' : '累计完成', value: data.completedDays, unit: '天' },
      day
        ? { label: 'AI 反馈', value: data.feedbackCount, unit: '次' }
        : { label: '到期复习', value: data.due, unit: '条' }
    ],
    days: data.days.map((item) => ({ ...item })),
    observations: observations
      ? [
          ...data.weaknesses.slice(0, 1).map((item) => ({ label: '继续练习', text: clean(item.label, 18) })),
          ...data.strengths.slice(0, 1).map((item) => ({ label: '本次表现', text: clean(item.label, 18) }))
        ]
      : []
  };
}

// Works with the browser 2D context and uni-app's existing canvas context.
export function paintStudyPoster(ctx, model, mascot = null) {
  const set = (name, value) => {
    const legacy = {
      fillStyle: 'setFillStyle',
      strokeStyle: 'setStrokeStyle',
      lineWidth: 'setLineWidth',
      fontSize: 'setFontSize'
    }[name];
    if (legacy && typeof ctx[legacy] === 'function') ctx[legacy](value);
    else if (name === 'fontSize') ctx.font = `${value}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
    else ctx[name] = value;
  };
  const text = (value, x, y, size = 13, color = '#67655f') => {
    set('fillStyle', color);
    set('fontSize', size);
    ctx.fillText(String(value), x, y);
  };
  const line = (y) => {
    set('strokeStyle', '#dedbd4');
    set('lineWidth', 1);
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(332, y);
    ctx.stroke();
  };
  set('fillStyle', '#f7f5ef');
  ctx.fillRect(0, 0, 360, 480);
  if (mascot) ctx.drawImage(mascot, 282, 24, 52, 52);
  text('Yozi AI', 28, 46, 15, '#25231f');
  text(model.title, 28, 91, 26, '#25231f');
  text(model.date.replaceAll('-', '.'), 28, 118, 12);
  line(139);
  for (const [index, stat] of model.stats.entries()) {
    const x = 28 + index * 106;
    text(stat.value, x, 183, 30, '#25231f');
    text(stat.unit, x + Math.min(70, String(stat.value).length * 19 + 5), 181, 11);
    text(stat.label, x, 208, 12);
  }
  text('最近七日 · 提交次数', 28, 253, 13, '#25231f');
  const maximum = Math.max(1, ...model.days.map((item) => item.count));
  for (const [index, item] of model.days.entries()) {
    const x = 32 + index * 44,
      height = Math.round((item.count / maximum) * 60);
    set('fillStyle', item.day === model.date ? '#9e7656' : '#c7bba8');
    if (height) ctx.fillRect(x, 332 - height, 24, height);
    text(item.count, x + 5, 324 - height, 11, '#55524b');
    text(item.day.slice(5).replace('-', '/'), x - 3, 351, 10);
  }
  line(367);
  for (const [index, item] of model.observations.entries()) {
    text(`${item.label} · ${item.text}`, 28, 393 + index * 20, 11, '#55524b');
  }
  text('Yozi AI', 28, 443, 11, '#25231f');
  if (model.observations.length) text('AI 评估', 282, 443, 11);
}
