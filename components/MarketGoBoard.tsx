'use client';

import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MarketData } from '@/hooks/useMarketStream';
import { useAffinityRadar } from '@/hooks/useAffinityRadar';
import { calculateResonance, demoPortfolio, getTransitionRoute, type TransitionRoute } from '@/lib/portfolio';

export type MarketNode = {
  symbol: string;
  market?: MarketData;
  position: THREE.Vector3;
  kind: 'stable' | 'volatile' | 'knot';
};

export type MarketGoInteraction = 'click' | 'long-press' | 'double-click';

export type MarketGoBoardProps = {
  markets?: MarketData[];
  className?: string;
  onNodeInteract?: (node: MarketNode, interaction: MarketGoInteraction) => void;
  onNodeHover?: (node: MarketNode) => void;
};

const syntheticSymbols = Array.from({ length: 264 }, (_, index) => `NODE_${String(index + 1).padStart(3, '0')}`);
const boardSize = 156;
const visibilityRadius = 58;
const beaconVertexShader = `
  attribute float aBeacon;
  varying float vBeacon;
  void main() {
    vBeacon = aBeacon;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const beaconFragmentShader = `
  uniform float uTime;
  varying float vBeacon;
  void main() {
    float shimmer = 0.55 + 0.45 * sin(uTime * 2.2 + gl_FragCoord.y * 0.04);
    float alpha = vBeacon * shimmer * 0.18;
    gl_FragColor = vec4(0.98, 0.72, 0.28, alpha);
  }
`;
const auraVertexShader = `
  attribute float aResonance;
  varying float vResonance;
  void main() {
    vResonance = aResonance;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const auraFragmentShader = `
  uniform float uTime;
  varying float vResonance;
  void main() {
    float pulse = 0.68 + 0.32 * sin(uTime * 3.4);
    gl_FragColor = vec4(1.0, 0.56, 0.12, vResonance * pulse * 0.16);
  }
`;

function positionForIndex(index: number): THREE.Vector3 {
  const columns = 24;
  const x = (index % columns - (columns - 1) / 2) * 2.8;
  const z = (Math.floor(index / columns) - 5.5) * 2.8;
  return new THREE.Vector3(x, 0.08, z);
}

function nodeKind(market?: MarketData): MarketNode['kind'] {
  if (market?.physics_event === 'knot_burst' || market?.knot_type) return 'knot';
  if ((market?.rsi_tension ?? 0) >= 0.7 || Math.abs(market?.s15_delta ?? 0) >= 50) return 'volatile';
  return 'stable';
}

function createNodes(markets: MarketData[]): MarketNode[] {
  const marketBySymbol = new Map(markets.map((market) => [market.symbol.toUpperCase(), market]));
  const symbols = markets.length ? markets.map((market) => market.symbol.toUpperCase()) : syntheticSymbols;
  return symbols.map((symbol, index) => ({
    symbol,
    market: marketBySymbol.get(symbol),
    position: positionForIndex(index),
    kind: nodeKind(marketBySymbol.get(symbol)),
  }));
}

function statusFor(node: MarketNode): string {
  return node.market?.tri_layer.micro ?? (node.kind === 'volatile' ? 'HIGH VOLATILITY' : node.kind === 'knot' ? 'KNOT FORMING' : 'STABLE');
}

function volatilityFor(node: MarketNode): string {
  const tension = node.market?.rsi_tension;
  return typeof tension === 'number' ? `${Math.round(tension * 100)}% tension` : node.kind === 'volatile' ? 'elevated' : 'quiet';
}

function MatrixNodes({ nodes, onSelect, onNodeInteract, onNodeHover }: { nodes: MarketNode[]; onSelect?: (node: MarketNode) => void; onNodeInteract?: (node: MarketNode, interaction: MarketGoInteraction) => void; onNodeHover?: (node: MarketNode) => void }) {
  const stableRef = useRef<THREE.InstancedMesh>(null);
  const volatileRef = useRef<THREE.InstancedMesh>(null);
  const knotRef = useRef<THREE.InstancedMesh>(null);
  const beaconRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const beaconMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const auraMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const { camera, pointer, raycaster } = useThree();
  const affinityMap = useAffinityRadar(nodes.map((node) => ({
    symbol: node.symbol,
    rsi_tension: node.market?.rsi_tension,
    s15_delta: node.market?.s15_delta ?? 0,
    wuxing_phase: node.market?.wuxing_phase ?? 'EARTH',
    tarot_attribute: node.market?.tarot_attribute,
    rendered_physics: node.market?.rendered_physics,
  })));
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hoverPoint = useMemo(() => new THREE.Vector3(), []);
  const worldPoint = useMemo(() => new THREE.Vector3(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const zeroScale = useMemo(() => new THREE.Vector3(0.001, 0.001, 0.001), []);
  const beaconStrengths = useMemo(() => new Float32Array(nodes.map((node) => {
    const tension = node.market?.rsi_tension ?? node.market?.rendered_physics?.tension_t ?? 0;
    return Math.max(0, Math.min(1, Math.max(tension, Math.abs(node.market?.s15_delta ?? 0) / 100)) - 0.58) / 0.42;
  })), [nodes]);
  const resonanceStrengths = useMemo(() => new Float32Array(nodes.map((node) => affinityMap.get(node.symbol)?.score ?? 0)), [nodes, affinityMap]);
  const initialized = useRef(false);

  useFrame((state) => {
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, hoverPoint);
    const elapsed = state.clock.getElapsedTime();
    const meshes = [stableRef.current, volatileRef.current, knotRef.current];
    if (beaconMaterialRef.current) beaconMaterialRef.current.uniforms.uTime.value = elapsed;
    if (auraMaterialRef.current) auraMaterialRef.current.uniforms.uTime.value = elapsed;

    nodes.forEach((node, index) => {
      const distanceToCursor = hoverPoint.distanceTo(node.position);
      const isFocused = distanceToCursor < 5.2;
      const distanceToCamera = camera.position.distanceTo(node.position);
      const isInRenderRange = distanceToCamera < visibilityRadius;
      const lift = isFocused && isInRenderRange ? 0.3 + Math.min(1, (5.2 - distanceToCursor) / 5.2) * 1.4 : 0.02;
      const pulse = isFocused ? 1 + Math.sin(elapsed * 3.5 + index) * 0.08 : 0.72;
      const activeMesh = meshes[node.kind === 'stable' ? 0 : node.kind === 'volatile' ? 1 : 2];
      const inactiveMeshes = meshes.filter((mesh) => mesh !== activeMesh);

      const visibleScale = isFocused ? pulse : 0.08;
      scale.set(isInRenderRange ? visibleScale : zeroScale.x, isInRenderRange ? visibleScale : zeroScale.y, isInRenderRange ? visibleScale : zeroScale.z);
      worldPoint.set(node.position.x, node.position.y + lift, node.position.z);
      matrix.compose(worldPoint, quaternion, scale);
      activeMesh?.setMatrixAt(index, matrix);
      inactiveMeshes.forEach((mesh) => mesh?.setMatrixAt(index, new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)));

      const affinity = resonanceStrengths[index] ?? 0;
      const auraActive = isFocused && affinity >= 0.58;
      const auraScale = auraActive ? 1.22 + Math.sin(elapsed * 3.4 + index) * 0.08 : 0.001;
      scale.set(auraScale, auraScale, auraScale);
      worldPoint.set(node.position.x, node.position.y, node.position.z);
      matrix.compose(worldPoint, quaternion, scale);
      auraRef.current?.setMatrixAt(index, matrix);

      const beaconActive = beaconStrengths[index] > 0.01 && isInRenderRange;
      scale.set(beaconActive ? 1 : 0.001, beaconActive ? 1 : 0.001, beaconActive ? 1 : 0.001);
      worldPoint.set(node.position.x, node.position.y + 1.4, node.position.z);
      matrix.compose(worldPoint, quaternion, scale);
      beaconRef.current?.setMatrixAt(index, matrix);
    });

    if (!initialized.current) initialized.current = true;
    meshes.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
    if (auraRef.current) auraRef.current.instanceMatrix.needsUpdate = true;
    if (beaconRef.current) beaconRef.current.instanceMatrix.needsUpdate = true;
  });

  function handlePointer(event: ThreeEvent<PointerEvent>) {
    if (event.instanceId === undefined) return;
    setHoveredIndex(event.instanceId);
    onNodeHover?.(nodes[event.instanceId]);
    event.stopPropagation();
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    setHoveredIndex(null);
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (event.instanceId === undefined) return;
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      const node = nodes[event.instanceId ?? -1];
      if (node) {
        longPressTriggered.current = true;
        onNodeInteract?.(node, 'long-press');
      }
    }, 520);
  }

  function handlePointerUp() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.instanceId === undefined) return;
    event.stopPropagation();
    const node = nodes[event.instanceId];
    if (node && !longPressTriggered.current) {
      onNodeInteract?.(node, 'click');
      onSelect?.(node);
    }
    longPressTriggered.current = false;
  }

  function handleDoubleClick(event: ThreeEvent<MouseEvent>) {
    if (event.instanceId === undefined) return;
    event.stopPropagation();
    const node = nodes[event.instanceId];
    if (node) onNodeInteract?.(node, 'double-click');
  }

  const hoveredNode = hoveredIndex === null ? undefined : nodes[hoveredIndex];
  const hoveredAffinity = hoveredNode ? affinityMap.get(hoveredNode.symbol) : undefined;

  return (
    <>
      <instancedMesh ref={stableRef} args={[undefined, undefined, nodes.length]} frustumCulled onPointerMove={handlePointer} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshStandardMaterial color="#55e6bd" emissive="#0b6b68" emissiveIntensity={0.7} metalness={0.7} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={volatileRef} args={[undefined, undefined, nodes.length]} frustumCulled onPointerMove={handlePointer} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        <icosahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial color="#f38ba8" emissive="#8f183f" emissiveIntensity={0.9} metalness={0.55} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={knotRef} args={[undefined, undefined, nodes.length]} frustumCulled onPointerMove={handlePointer} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        <torusKnotGeometry args={[0.28, 0.09, 48, 8, 2, 3]} />
        <meshStandardMaterial color="#f5d06f" emissive="#9a6410" emissiveIntensity={0.85} metalness={0.72} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={auraRef} args={[undefined, undefined, nodes.length]} frustumCulled>
        <boxGeometry args={[0.78, 0.78, 0.78]}>
          <instancedBufferAttribute attach="attributes-aResonance" args={[resonanceStrengths, 1]} />
        </boxGeometry>
        <shaderMaterial ref={auraMaterialRef} vertexShader={auraVertexShader} fragmentShader={auraFragmentShader} uniforms={{ uTime: { value: 0 } }} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[undefined, undefined, nodes.length]} frustumCulled>
        <boxGeometry args={[0.09, 2.8, 0.09]}>
          <instancedBufferAttribute attach="attributes-aBeacon" args={[beaconStrengths, 1]} />
        </boxGeometry>
        <shaderMaterial ref={beaconMaterialRef} vertexShader={beaconVertexShader} fragmentShader={beaconFragmentShader} uniforms={{ uTime: { value: 0 } }} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      {hoveredNode && <Html position={[hoveredNode.position.x, hoveredNode.position.y + 2.25, hoveredNode.position.z]} center distanceFactor={9} occlude>
        <div className="market-go-tooltip min-w-44 border border-cyan-200/40 bg-[#031018]/95 px-3 py-2 font-mono text-[10px] text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.28)]">
          <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-200/60">{hoveredNode.kind} node</p>
          <p className="mt-1 text-sm tracking-[0.12em]">{hoveredNode.symbol}</p>
          <p className="mt-2 border-t border-white/10 pt-2 uppercase tracking-[0.12em] text-amber-100/80">{statusFor(hoveredNode)}</p>
          <p className="mt-1 text-cyan-100/60">{volatilityFor(hoveredNode)}</p>
          {hoveredAffinity && hoveredAffinity.score >= 0.58 && <div className="mt-2 border-t border-amber-200/20 pt-2 text-amber-100">
            <p className="tracking-[0.14em] text-amber-300">SYNERGY MATCH: {Math.round(hoveredAffinity.score * 100)}%</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-amber-100/70">{hoveredAffinity.reason}</p>
          </div>}
        </div>
      </Html>}
    </>
  );
}

function MarketGoTransition({ route, symbol }: { route: TransitionRoute; symbol: string }) {
  return <div className={`market-go-transition ${route === 'lens' ? 'market-go-transition-lens' : 'market-go-transition-voxel'}`} aria-label={`${route} transition for ${symbol}`}>
    <div className="market-go-transition-core" />
    <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-100/70">{route} route / locking {symbol}</p>
  </div>;
}

export default function MarketGoBoard({ markets = [], className, onNodeInteract, onNodeHover }: MarketGoBoardProps) {
  const router = useRouter();
  const [transition, setTransition] = useState<{ symbol: string; route: TransitionRoute } | null>(null);
  const nodes = useMemo(() => createNodes(markets), [markets]);

  function selectMarket(node: MarketNode) {
    const market = node.market;
    const route = getTransitionRoute(calculateResonance(demoPortfolio, market ? {
      symbol: market.symbol,
      s15Delta: market.s15_delta,
      renderedPhysics: market.rendered_physics ? { complexity_c: market.rendered_physics.complexity_c } : undefined,
      isEmperorSynchronized: market.is_emperor_synchronized,
    } : undefined));
    setTransition({ symbol: node.symbol, route });
    window.setTimeout(() => router.push(`/live/${encodeURIComponent(node.symbol)}?transition=${route}`), 720);
  }

  return (
    <div className={className ?? 'relative h-[720px] w-full overflow-hidden bg-[#010509]'}>
      <Canvas camera={{ position: [0, 13, 18], fov: 48, near: 0.1, far: 180 }} dpr={[1, 1.5]} frameloop="always">
        <color attach="background" args={['#010509']} />
        <fog attach="fog" args={['#010509', 35, 110]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 8, 2]} intensity={28} distance={42} color="#38d9d0" />
        <pointLight position={[-20, 4, -16]} intensity={18} distance={38} color="#3975ff" />
        <gridHelper args={[boardSize, 56, '#0b6370', '#06242d']} position={[0, 0, 0]} />
        <MatrixNodes nodes={nodes} onSelect={onNodeInteract ? undefined : selectMarket} onNodeInteract={onNodeInteract} onNodeHover={onNodeHover} />
        <OrbitControls enableDamping dampingFactor={0.08} enablePan enableZoom minDistance={5} maxDistance={74} maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-5 top-5 flex items-start justify-between font-mono text-[10px] uppercase tracking-[0.26em] text-cyan-100/50">
        <span>Market go board / {nodes.length} intersections</span>
        <span className="hidden sm:block">Drag to pan / scroll to zoom</span>
      </div>
      {transition && <MarketGoTransition symbol={transition.symbol} route={transition.route} />}
    </div>
  );
}
