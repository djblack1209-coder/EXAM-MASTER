#!/usr/bin/env node
// 本地可选渲染器；不安装依赖、不监听网络、不接收模型代码。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { visualRecipe, manimVisualSource } from '../../laf-backend/functions/_shared/learning-visual.js';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const TMP = path.join(ROOT, 'tmp');
const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const PYTHON = process.env.YOZI_MANIM_PYTHON || '/opt/homebrew/bin/python3';
export async function safeRenderDirectory(directory) {
  const target = path.resolve(directory);
  if (!target.startsWith(`${TMP}${path.sep}`)) throw new Error('渲染只能写入本仓库 tmp 下的独立目录');
  let parent = target;
  while (true) {
    try {
      const real = await fs.realpath(parent);
      if (real !== TMP && !real.startsWith(`${TMP}${path.sep}`)) throw new Error('渲染路径不能借符号链接越界');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const next = path.dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
  return target;
}
async function run(executable, args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '',
      expired = false,
      hardTimer;
    const stop = () => {
      child.kill('SIGTERM');
      hardTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    };
    const timer = setTimeout(() => {
      expired = true;
      stop();
    }, timeout);
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    const receive = (data) => {
      output = (output + String(data)).slice(-16000);
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    const finish = () => {
      clearTimeout(timer);
      clearTimeout(hardTimer);
      process.removeListener('SIGTERM', stop);
      process.removeListener('SIGINT', stop);
    };
    child.once('error', (error) => {
      finish();
      reject(error);
    });
    child.once('close', (code) => {
      finish();
      resolve({ code, expired, output, pid: child.pid });
    });
  });
}
export function blenderVisualSource(input, frameDirectory, blendPath) {
  const r = visualRecipe(input);
  if (r.template !== 'distance_displacement' || r.direction === 'left')
    throw new Error('当前离线视频适配只支持向右往返；新科学模板可逐步观察');
  return `import bpy\nfrom mathutils import Vector\n\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete(use_global=False)\ns = bpy.context.scene\ns.render.engine = 'BLENDER_WORKBENCH'\ns.render.resolution_x = 640\ns.render.resolution_y = 360\ns.render.resolution_percentage = 100\ns.render.fps = 24\ns.render.image_settings.file_format = 'PNG'\ns.display.shading.light = 'STUDIO'\ns.display.shading.color_type = 'OBJECT'\ns.display.shading.show_shadows = False\ns.display.shading.show_cavity = True\ns.display.shading.background_type = 'WORLD'\ns.world.color = (0.028, 0.018, 0.052)\nbpy.ops.object.camera_add(location=(0,0,10))\ncamera = bpy.context.object\ncamera.data.type = 'ORTHO'\ncamera.data.ortho_scale = 11\ns.camera = camera\n\ndef bar(name, x, y, length, color):\n    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0))\n    obj = bpy.context.object\n    obj.name = name\n    obj.scale = (max(length, 0.001), 0.055, 0.055)\n    obj.color = (*color, 1)\n    return obj\n\ndef text(name, value, x, y, size=0.32):\n    bpy.ops.object.text_add(location=(x, y, 0.15))\n    obj = bpy.context.object\n    obj.name = name\n    obj.data.body = value\n    obj.data.size = size\n    obj.color = (0.9, 0.87, 1, 1)\n    return obj\n\nbar('axis', 0, 0.4, 8, (0.17,0.39,0.65))\ntext('title', 'Distance vs displacement', -4.4, 2.15, 0.42)\ntext('start', '0 m', -4.3, -0.1)\ntext('turn', '${r.outward} m', 3.55, -0.1)\ndistance = text('distance', '', -4.4, -1.5)\ndisplacement = text('displacement', '', -4.4, -2.05)\nbpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.24, location=(-4,0.4,0.25))\ndot = bpy.context.object\ndot.name = 'traveller'\ndot.color = (0.58, 0.35, 0.95, 1)\nfor face in dot.data.polygons: face.use_smooth = True\ntrail = bar('outward-trail', -4, 0.75, 0.001, (0.58,0.35,0.95))\nback = bar('return-trail', 4, 0.95, 0.001, (0.28,0.59,0.95))\ns.frame_start = 1\ns.frame_end = 144\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(blendPath)})\nfor frame in range(1,145):\n    travelled = ${r.outward + r.backward} * (frame - 1) / 143\n    position = travelled if travelled <= ${r.outward} else 2 * ${r.outward} - travelled\n    dot.location.x = -4 + 8 * position / ${r.outward}\n    length = 8 * min(travelled, ${r.outward}) / ${r.outward}\n    trail.scale.x = max(length,0.001)\n    trail.location.x = -4 + length / 2\n    return_length = 8 * max(0,travelled - ${r.outward}) / ${r.outward}\n    back.scale.x = max(return_length,0.001)\n    back.location.x = 4 - return_length / 2\n    distance.data.body = f'Distance: {travelled:.1f} m'\n    displacement.data.body = f'Displacement: {position:.1f} m right'\n    s.render.filepath = ${JSON.stringify(frameDirectory)} + f'/{frame:04d}.png'\n    bpy.ops.render.render(write_still=True)\n`;
}
async function main() {
  const args = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') {
      options.check = true;
      continue;
    }
    if (!['--engine', '--recipe', '--output'].includes(args[i]) || !args[i + 1])
      throw new Error('参数只接受 --check / --engine / --recipe / --output');
    options[args[i].slice(2)] = args[++i];
  }
  const engine = options.engine || 'manim';
  if (!['manim', 'blender'].includes(engine)) throw new Error('渲染引擎未授权');
  const probe =
    engine === 'manim'
      ? await run(PYTHON, [
          '-I',
          '-c',
          'import importlib.util; print("available" if importlib.util.find_spec("manim") else "unavailable")'
        ])
      : await run(BLENDER, ['--version']);
  const available = probe.code === 0 && (engine !== 'manim' || probe.output.trim() === 'available');
  if (!available || options.check) {
    console.log(
      JSON.stringify({
        engine,
        available,
        code: available ? 'AVAILABLE' : 'RENDERER_UNAVAILABLE',
        installedDependencies: false
      })
    );
    if (!available) process.exitCode = 2;
    return;
  }
  if (!options.recipe || !options.output) throw new Error('渲染需要明确的有界配方与隔离输出目录');
  const source = await fs.readFile(options.recipe, 'utf8');
  if (source.length > 4096) throw new Error('演示配方超出长度预算');
  const input = JSON.parse(source),
    recipe = visualRecipe(input),
    output = await safeRenderDirectory(options.output);
  if (recipe.template !== 'distance_displacement' || recipe.direction === 'left')
    throw new Error('当前离线视频适配只支持向右往返；新科学模板可逐步观察');
  // 一个任务拥有一个新目录，不覆盖其他任务或恢复证据。
  await fs.mkdir(output, { recursive: false });
  const work = path.join(output, 'work');
  await fs.mkdir(work);
  let result;
  if (engine === 'manim') {
    const script = path.join(work, 'scene.py');
    await fs.writeFile(script, manimVisualSource(input));
    result = await run(
      PYTHON,
      [
        '-I',
        '-m',
        'manim',
        '-ql',
        '--disable_caching',
        '--media_dir',
        path.join(output, 'media'),
        script,
        'YoziDistance'
      ],
      120000
    );
  } else {
    const frames = path.join(output, 'frames');
    await fs.mkdir(frames);
    const script = path.join(work, 'scene.py');
    await fs.writeFile(script, blenderVisualSource(input, frames, path.join(output, 'scene.blend')));
    result = await run(
      BLENDER,
      [
        '--background',
        '--factory-startup',
        '--disable-autoexec',
        '--threads',
        '2',
        '--python-exit-code',
        '1',
        '--python',
        script
      ],
      120000
    );
    if (result.code === 0 && !result.expired)
      result = await run(
        FFMPEG,
        [
          '-nostdin',
          '-n',
          '-framerate',
          '24',
          '-i',
          path.join(frames, '%04d.png'),
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '28',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          path.join(output, 'demo.mp4')
        ],
        30000
      );
  }
  await fs.writeFile(
    path.join(output, 'job.json'),
    JSON.stringify(
      {
        engine,
        recipe,
        success: result.code === 0 && !result.expired,
        pid: result.pid,
        expired: result.expired,
        code: result.code
      },
      null,
      2
    ) + '\n'
  );
  await fs.writeFile(path.join(output, 'render.log'), result.output);
  if (result.code !== 0 || result.expired)
    throw new Error(`演示渲染未完成：${result.expired ? '超时并终止' : '引擎退出失败'}；回执保留于隔离目录`);
  console.log(JSON.stringify({ engine, success: true, output, duration: recipe.duration, costs: 0 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
