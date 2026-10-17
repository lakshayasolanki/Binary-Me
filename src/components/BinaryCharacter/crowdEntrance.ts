import { SOURCE_HEIGHT, SOURCE_WIDTH } from "./binaryRenderer";
import { createCrowdLayers, type CrowdLayer } from "./crowdLayers";
import { ENTRANCE_DURATION, sampleCrowdMotion } from "./crowdMotion";

export { ENTRANCE_DURATION } from "./crowdMotion";

interface Options {
  backCanvas: HTMLCanvasElement;
  frontCanvas: HTMLCanvasElement;
  source: HTMLImageElement;
  background: HTMLImageElement;
  gDonor: HTMLImageElement;
  mask: HTMLImageElement;
  onReady: () => void;
  onSettled: () => void;
  onFrame?: (time: number) => void;
  freezeAt?: number;
  onlyPerson?: string;
}

// A continuous skinned mesh, rather than independently shifted rows. Head and shoulders
// articulate around their own anchors; shared vertices keep the grain free of strip seams.
const vertexSource = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  uniform vec2 u_move;
  uniform vec2 u_neck;
  uniform float u_scale;
  uniform float u_body;
  uniform float u_head;
  uniform float u_shoulder;
  uniform float u_lift;
  vec2 rotatePoint(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c*p.x-s*p.y, s*p.x+c*p.y);
  }
  void main() {
    vec2 p = a_position;
    vec2 hip = vec2(u_neck.x, 965.0);
    p = hip + rotatePoint(p - hip, u_body);
    vec2 neck = hip + rotatePoint(u_neck - hip, u_body);
    float headWeight = 1.0 - smoothstep(u_neck.y - 45.0, u_neck.y + 55.0, a_position.y);
    p = mix(p, neck + rotatePoint(p - neck, u_head), headWeight);
    float shoulderWeight = exp(-pow((a_position.y - u_shoulder)/110.0, 2.0));
    p.y += u_lift * clamp((a_position.x-u_neck.x)/190.0, -1.0, 1.0) * shoulderWeight;
    p = u_neck + (p - u_neck) * u_scale + u_move;
    gl_Position = vec4(p.x / ${SOURCE_WIDTH}.0 * 2.0 - 1.0, 1.0 - p.y / ${SOURCE_HEIGHT}.0 * 2.0, 0.0, 1.0);
    v_uv = a_uv;
  }
`;
const fragmentSource = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  void main() { gl_FragColor = texture2D(u_image, v_uv); }
`;

function createPlane(canvas: HTMLCanvasElement, layers: CrowdLayer[]) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("Crowd rendering is unavailable");
  const shader = (type: number, source: string) => {
    const result = gl.createShader(type)!;
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      gl.deleteShader(result);
      throw new Error("Crowd shader compilation failed");
    }
    return result;
  };
  const program = gl.createProgram()!;
  const vertex = shader(gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Crowd shader link failed");
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "a_position");
  const uv = gl.getAttribLocation(program, "a_uv");
  const uniform = Object.fromEntries(["move", "neck", "scale", "body", "head", "shoulder", "lift"].map(key => [key, gl.getUniformLocation(program, `u_${key}`)]));
  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const meshes = layers.map(layer => {
    const vertices: number[] = [];
    const cols = 12, rows = 24;
    const append = (x: number, y: number) => vertices.push(layer.bounds.x + x / cols * layer.bounds.width, layer.bounds.y + y / rows * layer.bounds.height, x / cols, y / rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      append(x, y); append(x + 1, y); append(x, y + 1);
      append(x, y + 1); append(x + 1, y); append(x + 1, y + 1);
    }
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.canvas);
    return { layer, buffer, texture, count: vertices.length / 4 };
  });
  return {
    draw(t: number) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      for (const { layer, buffer, texture, count } of meshes) {
        const pose = sampleCrowdMotion(t, layer.person);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform2f(uniform.move, pose.x, pose.y);
        gl.uniform2f(uniform.neck, layer.person.neck[0], layer.person.neck[1]);
        gl.uniform1f(uniform.scale, pose.scale);
        gl.uniform1f(uniform.body, pose.bodyAngle);
        gl.uniform1f(uniform.head, pose.headAngle);
        gl.uniform1f(uniform.shoulder, layer.person.shoulderY);
        gl.uniform1f(uniform.lift, pose.shoulderLift);
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
    },
    destroy() {
      for (const mesh of meshes) { gl.deleteBuffer(mesh.buffer); gl.deleteTexture(mesh.texture); }
      gl.deleteProgram(program);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}

export function createCrowdEntrance(options: Options) {
  const layers = createCrowdLayers(options.source, options.background, options.gDonor, options.mask);
  // Development-only single-person study leaves the other six at their final pose.
  const movingLayers = layers.map(layer => options.onlyPerson && options.onlyPerson !== layer.person.id ? { ...layer, person: { ...layer.person, startX: 0, startY: 0, depth: 0, weight: 0 } } : layer);
  const back = createPlane(options.backCanvas, movingLayers.filter(layer => layer.person.plane === "back"));
  let front: ReturnType<typeof createPlane>;
  try { front = createPlane(options.frontCanvas, movingLayers.filter(layer => layer.person.plane === "front")); }
  catch (error) { back.destroy(); throw error; }
  let frameId = 0;
  let began = false;
  let destroyed = false;
  let settled = false;
  let startTime: number | null = null;
  let lastTime = 0;
  const render = (t: number) => { back.draw(t); front.draw(t); options.onFrame?.(t); lastTime = t; };
  const resize = new ResizeObserver(() => { if (began && !destroyed && !settled) render(lastTime); });
  const removeContextListeners = () => {
    options.backCanvas.removeEventListener("webglcontextlost", contextLost);
    options.frontCanvas.removeEventListener("webglcontextlost", contextLost);
  };
  const finish = () => {
    if (destroyed || settled) return;
    settled = true;
    cancelAnimationFrame(frameId); frameId = 0;
    resize.disconnect();
    removeContextListeners();
    // Reveal the unchanged reference in the same frame; there is no opacity animation.
    options.onSettled();
    back.destroy(); front.destroy();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    finish();
  };
  options.backCanvas.addEventListener("webglcontextlost", contextLost);
  options.frontCanvas.addEventListener("webglcontextlost", contextLost);
  const tick = (now: number) => {
    if (destroyed || settled) return;
    startTime ??= now;
    const elapsed = (now - startTime) / 1000;
    if (elapsed >= ENTRANCE_DURATION) { finish(); return; }
    render(elapsed);
    frameId = requestAnimationFrame(tick);
  };
  return {
    start() {
      if (began || destroyed || settled) return;
      began = true;
      render(options.freezeAt ?? 0);
      options.onReady();
      resize.observe(options.frontCanvas);
      if (options.freezeAt === undefined) frameId = requestAnimationFrame(tick);
    },
    finish,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frameId);
      resize.disconnect();
      removeContextListeners();
      if (!settled) { back.destroy(); front.destroy(); }
    },
  };
}
