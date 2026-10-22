// GPGPU (FBO ping-pong) fluid for PortfolioRadar.
//
// State lives in two float textures advanced entirely on the GPU:
//   texturePosition: xyz = position, w = age in [0, 1)
//   textureVelocity: xyz = velocity
// Pass order each frame: velocity (advect + wall response) -> position
// (integrate + SDF projection + respawn). The CPU only uploads ~20 uniforms.

export const FLUID_SIZE = 80; // 80 x 80 = 6400 particles
export const FLUID_PARTICLES = FLUID_SIZE * FLUID_SIZE;
export const FLUID_JETS = 4;

// Hard-coded NaN/Inf guard + per-grid-cell speed ceiling (mirrors
// distortion_field.py::cell_speed_cap). Poles are capped lower than the
// equator because the 48-cell grid pinches there.
const COMMON = /* glsl */ `
  uniform float uTime, uC00, uC10, uC20, uC22;
  const float PI = 3.14159265359;
  const float HARD_MAX_SPEED = 4.0;

  bool isBad(vec3 v) {
    return !(v.x == v.x && v.y == v.y && v.z == v.z) || dot(v, v) > 1.0e8;
  }

  float barrierRadius(vec3 p) {
    vec3 d = normalize(p + vec3(1.0e-6));
    float theta = acos(clamp(d.y, -1.0, 1.0));
    float phi = atan(d.z, d.x);
    float c = cos(theta);
    return 1.0 + uC00 * 0.5 * sqrt(1.0 / PI) + uC10 * 0.5 * sqrt(3.0 / PI) * c
      + uC20 * 0.25 * sqrt(5.0 / PI) * (3.0 * c * c - 1.0)
      + uC22 * 0.25 * sqrt(15.0 / PI) * sin(theta) * sin(theta) * cos(2.0 * phi);
  }
  float sdf(vec3 p) { return length(p) - barrierRadius(p); }
  vec3 sdfNormal(vec3 p) {
    vec2 e = vec2(0.02, 0.0);
    return normalize(vec3(
      sdf(p + e.xyy) - sdf(p - e.xyy),
      sdf(p + e.yxy) - sdf(p - e.yxy),
      sdf(p + e.yyx) - sdf(p - e.yyx)) + vec3(1.0e-6));
  }

  float cellSpeedCap(vec3 p) {
    vec3 d = normalize(p + vec3(1.0e-6));
    float theta = acos(clamp(d.y, -1.0, 1.0));
    float phi = atan(d.z, d.x) + PI;
    float row = floor(clamp(theta / PI * 6.0, 0.0, 5.999));
    float col = floor(clamp(phi / (2.0 * PI) * 8.0, 0.0, 7.999));
    float thetaRow = (row + 0.5) / 6.0 * PI;
    return (1.4 + 1.8 * sin(thetaRow)) * (mod(col, 2.0) < 0.5 ? 1.0 : 0.9);
  }

  vec3 clampSpeed(vec3 v, vec3 at) {
    if (isBad(v)) return vec3(0.0);
    float cap = min(cellSpeedCap(at), HARD_MAX_SPEED);
    float s = length(v);
    return s > cap ? v * (cap / s) : v;
  }
`;

export const velocityShader = /* glsl */ `
  ${COMMON}
  uniform float uDt, uViscosity;
  uniform vec4 uJets[${FLUID_JETS}];

  vec3 curlField(vec3 p, float t) {
    vec3 q = p * 1.7;
    float k = 1.7;
    float dAz_dy = -sin(q.x - t * 0.21) * sin(q.y + t * 0.29) * k;
    float dAy_dz = cos(q.z + t * 0.27) * cos(q.x + t * 0.19) * k;
    float dAx_dz = -sin(q.y + t * 0.31) * sin(q.z - t * 0.23) * k;
    float dAz_dx = cos(q.x - t * 0.21) * cos(q.y + t * 0.29) * k;
    float dAy_dx = -sin(q.z + t * 0.27) * sin(q.x + t * 0.19) * k;
    float dAx_dy = cos(q.y + t * 0.31) * cos(q.z - t * 0.23) * k;
    return vec3(dAz_dy - dAy_dz, dAx_dz - dAz_dx, dAy_dx - dAx_dy);
  }

  vec3 field(vec3 p, float t) {
    vec3 u = 0.55 * curlField(p, t);
    for (int i = 0; i < ${FLUID_JETS}; i++) {
      vec3 axis = normalize(uJets[i].xyz + vec3(1.0e-4));
      float gamma = clamp(uJets[i].w, -1.0, 1.0);
      vec3 r = p - axis * dot(p, axis);
      float rho2 = dot(r, r) + 0.08;
      u += gamma * (cross(axis, r) / rho2) * (1.0 - exp(-rho2 / 0.35)) * 0.35;
      u += gamma * axis * exp(-rho2 * 1.6) * 0.25;
    }
    return u;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pl = texture2D(texturePosition, uv);
    vec3 p = pl.xyz;
    vec3 v = texture2D(textureVelocity, uv).xyz;
    if (isBad(p) || isBad(v) || pl.w < 0.002) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // advect: relax towards the incompressible field (midpoint-sampled)
    vec3 u = clampSpeed(field(p, uTime), p);
    vec3 mid = p + 0.5 * uDt * u;
    u = clampSpeed(field(mid, uTime + 0.5 * uDt), mid);
    v = clampSpeed(mix(v, u, 1.0 - exp(-uDt * 6.0)), p);

    // boundary layer: kill the normal component, re-inject it as tangential
    // swirl (energy-preserving vortex along the barrier).
    vec3 q = p + v * uDt;
    float d = sdf(q);
    vec3 n = sdfNormal(q);
    float layer = exp(-abs(d) * 6.0);
    vec3 tang = v - n * dot(v, n);
    v = tang * (1.0 - 0.3 * layer) + cross(n, tang) * layer * uViscosity;
    if (d < 0.03) {
      float vn = dot(v, n);
      vec3 swirl = cross(n, tang);
      if (dot(swirl, swirl) < 1.0e-8) swirl = cross(n, abs(n.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
      v = tang + normalize(swirl) * abs(vn) + n * max(0.0, -d) * 6.0;
    }
    gl_FragColor = vec4(clampSpeed(v, p), 0.0);
  }
`;

export const positionShader = /* glsl */ `
  ${COMMON}
  uniform float uDt;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pl = texture2D(texturePosition, uv);
    vec3 v = texture2D(textureVelocity, uv).xyz;
    vec3 p = pl.xyz;
    float age = pl.w + uDt * 0.045;

    bool respawn = isBad(p) || isBad(v) || age >= 1.0 || length(p) > 3.4;
    if (respawn) {
      vec2 s = uv + fract(uTime * 0.37);
      float a = hash(s) * 2.0 * PI;
      float z = hash(s + 17.0) * 2.0 - 1.0;
      float rr = sqrt(max(0.0, 1.0 - z * z));
      p = vec3(rr * cos(a), z, rr * sin(a)) * (1.15 + hash(s + 41.0) * 1.5);
      gl_FragColor = vec4(p, 0.0001);
      return;
    }

    p += v * uDt;
    float d = sdf(p);
    if (d < 0.0) p += sdfNormal(p) * (-d + 0.01);
    gl_FragColor = vec4(p, age);
  }
`;

export const pointVertexShader = /* glsl */ `
  attribute vec2 aRef;
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uPixel;
  varying float vSpeed;
  varying float vNear;
  ${COMMON}
  void main() {
    vec4 pl = texture2D(uPosTex, aRef);
    vec3 v = texture2D(uVelTex, aRef).xyz;
    float life = pl.w;
    vSpeed = clamp(length(v) / 2.5, 0.0, 1.0);
    vNear = exp(-abs(sdf(pl.xyz)) * 7.0);
    vec4 mv = modelViewMatrix * vec4(pl.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * (1.0 + vNear) * (4.0 / -mv.z) * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.9, 1.0, life));
  }
`;

export const pointFragmentShader = /* glsl */ `
  varying float vSpeed;
  varying float vNear;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    vec3 slow = vec3(0.10, 0.45, 0.95);
    vec3 fast = vec3(0.98, 0.55, 0.25);
    vec3 col = mix(slow, fast, vSpeed) + vec3(0.6, 0.3, 0.9) * vNear * 0.5;
    gl_FragColor = vec4(col, a * (0.35 + 0.5 * vNear));
  }
`;
