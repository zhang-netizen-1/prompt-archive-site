import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyMedia } from '../scripts/lib/export.mjs';

test('只读模式复用既有媒体，缺失时报错且不创建文件', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-readonly-'));
  const source = path.join(root, 'original.mov');
  const mediaDir = path.join(root, 'media');
  fs.mkdirSync(mediaDir);
  const raw = Buffer.from('只读复用，不调用转码或海报工具');
  fs.writeFileSync(source, raw);
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  const name = `${hash}-h264-720p-v1.mp4`;
  const existing = path.join(mediaDir, name);
  fs.writeFileSync(existing, raw);
  try {
    const before = fs.statSync(existing);
    assert.equal(copyMedia(source, mediaDir, new Map(), { preserveMedia: true, optimizeMedia: true }), `/media/${name}`);
    assert.equal(fs.statSync(existing).mtimeMs, before.mtimeMs);
    assert.deepEqual(fs.readFileSync(existing), raw);
    assert.deepEqual(fs.readdirSync(mediaDir), [name]);
    fs.rmSync(existing);
    assert.throws(() => copyMedia(source, mediaDir, new Map(), { preserveMedia: true }), /只读媒体模式下缺少已有文件/);
    assert.deepEqual(fs.readdirSync(mediaDir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('公开版视频转为可播放的 720p MP4，复用缓存且不修改原片', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-optimization-'));
  const source = path.join(root, 'original.mov');
  const mediaDir = path.join(root, 'media');
  const cacheDir = path.join(root, 'cache');
  fs.mkdirSync(mediaDir);
  try {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=24',
      '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', source,
    ]);
    const original = fs.readFileSync(source);
    const copied = new Map();
    const options = { optimizeMedia: true, cacheDir };
    const url = copyMedia(source, mediaDir, copied, options);
    assert.match(url, /^\/media\/[a-f0-9]{16}-h264-720p-v1\.mp4$/);
    const output = path.join(mediaDir, path.basename(url));
    assert.ok(fs.statSync(output).size < original.length);
    const probe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height',
      '-of', 'json', output,
    ], { encoding: 'utf8' }));
    assert.equal(probe.streams[0].codec_name, 'h264');
    assert.equal(probe.streams[0].width, 1280);
    assert.equal(probe.streams[0].height, 720);
    assert.equal(copyMedia(source, mediaDir, copied, options), url);
    assert.deepEqual(fs.readFileSync(source), original);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
