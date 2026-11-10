// CPU : GPU activity, measured from inside a browser tab. A browser cannot read the OS activity
// monitor, so each side runs a small fixed benchmark a few times a second and compares its time
// with the fastest time seen: load ≈ 1 − fastest / now. When something else is using the CPU (or
// GPU), the benchmark slows down and the load rises. The difference CPU − GPU is the number the
// page plots. Optional stress generators make the meters move on purpose.
//
// On machines without a GPU (software WebGL) the "GPU" benchmark also runs on the CPU, so the two
// readings move together there; the page says so.

const CPU_BENCH = `onmessage = (e) => { const n = e.data; const t = performance.now(); let x = 0; for (let i = 0; i < n; i++) x += Math.sqrt(i ^ (x & 1023)); postMessage([performance.now() - t, x]); };`;
const CPU_STRESS = `let on = true; onmessage = (e) => { on = e.data; }; const spin = () => { const t = performance.now(); let x = 0; while (performance.now() - t < 40) x += Math.random(); setTimeout(spin, 0); }; spin();`;
const FRAG = `#version 300 es
precision highp float; uniform float iters; uniform float t; out vec4 o;
void main() { vec2 p = gl_FragCoord.xy / 256.0; float a = 0.0; for (float i = 0.0; i < 4000.0; i++) { if (i >= iters) break; a += sin(p.x * i + t) * cos(p.y * i - t); } o = vec4(fract(a), 0.0, 0.0, 1.0); }`;
const VERT = `#version 300 es
in vec2 v; void main() { gl_Position = vec4(v, 0.0, 1.0); }`;

export type LoadSample = { t: number; cpu: number; gpu: number; cpuMs: number; gpuMs: number };

class Baseline {
  private hist: number[] = []; private ema = 0;
  /** Load from the fastest of the last ~25 s, smoothed so single noisy runs do not jump. */
  push(ms: number) {
    this.hist.push(ms); if (this.hist.length > 60) this.hist.shift();
    const raw = Math.max(0, Math.min(1, 1 - Math.min(...this.hist) / ms));
    this.ema += (raw - this.ema) * 0.35; return this.ema;
  }
}

export class LoadMeter {
  private worker: Worker | null = null; private stressWorkers: Worker[] = [];
  private gl: WebGL2RenderingContext | null = null; private prog: WebGLProgram | null = null;
  private uIters: WebGLUniformLocation | null = null; private uT: WebGLUniformLocation | null = null;
  private timer = 0; private stressRaf = 0; private gpuStress = false;
  private cpuBase = new Baseline(); private gpuBase = new Baseline();
  private lastCpu = { load: 0, ms: 0 };
  gpuAvailable = false; softwareGpu = false;

  constructor(private onSample: (s: LoadSample) => void) {}

  start() {
    const url = URL.createObjectURL(new Blob([CPU_BENCH], { type: 'text/javascript' }));
    this.worker = new Worker(url); URL.revokeObjectURL(url);
    this.worker.onmessage = (e: MessageEvent<[number, number]>) => { this.lastCpu = { load: this.cpuBase.push(e.data[0]), ms: e.data[0] }; };
    this.initGl();
    const tick = () => {
      this.worker?.postMessage(400000);
      const g = this.benchGpu(200);
      this.onSample({ t: performance.now() / 1000, cpu: this.lastCpu.load, gpu: g.load, cpuMs: this.lastCpu.ms, gpuMs: g.ms });
    };
    this.timer = window.setInterval(tick, 400);
  }

  private initGl() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'v'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.gl = gl; this.prog = p; this.uIters = gl.getUniformLocation(p, 'iters'); this.uT = gl.getUniformLocation(p, 't');
    this.gpuAvailable = true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.softwareGpu = /swiftshader|llvmpipe|software/i.test(renderer);
  }

  private draw(iters: number) {
    const gl = this.gl!; gl.uniform1f(this.uIters, iters); gl.uniform1f(this.uT, performance.now() / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private benchGpu(iters: number) {
    if (!this.gl) return { load: 0, ms: 0 };
    const px = new Uint8Array(4); const t = performance.now();
    this.draw(iters); this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px); // forces the GPU to finish
    const ms = performance.now() - t;
    return { load: this.gpuBase.push(ms), ms };
  }

  setCpuStress(workers: number) {
    while (this.stressWorkers.length > workers) this.stressWorkers.pop()!.terminate();
    while (this.stressWorkers.length < workers) {
      const url = URL.createObjectURL(new Blob([CPU_STRESS], { type: 'text/javascript' }));
      this.stressWorkers.push(new Worker(url)); URL.revokeObjectURL(url);
    }
  }

  setGpuStress(on: boolean) {
    this.gpuStress = on; cancelAnimationFrame(this.stressRaf);
    if (!on || !this.gl) return;
    const loop = () => { if (!this.gpuStress) return; this.draw(2500); this.stressRaf = requestAnimationFrame(loop); };
    this.stressRaf = requestAnimationFrame(loop);
  }

  stop() {
    window.clearInterval(this.timer); this.worker?.terminate(); this.worker = null;
    this.setCpuStress(0); this.setGpuStress(false);
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); this.gl = null; this.prog = null;
  }
}

/** Tasks (symbols) choose the less-busy side, biased by their own affinity (0 = CPU, 1 = GPU). */
export const TASKS = [
  { sym: '♠', name: '物理', aff: 0.15 }, { sym: '♥', name: '音', aff: 0.1 }, { sym: '♦', name: 'パーティクル', aff: 0.85 }, { sym: '♣', name: 'AI', aff: 0.3 },
  { sym: '★', name: '影', aff: 0.9 }, { sym: '☽', name: '空', aff: 0.7 }, { sym: '☉', name: '光', aff: 0.8 }, { sym: '♁', name: '地形', aff: 0.5 },
] as const;
export function placeTask(aff: number, cpu: number, gpu: number): 'cpu' | 'gpu' {
  return gpu - cpu < (aff - 0.5) * 0.8 ? 'gpu' : 'cpu';
}
