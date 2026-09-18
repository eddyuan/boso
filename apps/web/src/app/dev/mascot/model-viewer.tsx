"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const MASCOT_URL = "/models/cockatiel.glb";

export const SPECIES = ["cockatiel", "puppy", "bunny", "cat"] as const;

// ?species=puppy|bunny|cat switches the model in the dev viewer.
export function modelUrl(species: string) {
  return `/models/${(SPECIES as readonly string[]).includes(species) ? species : "cockatiel"}.glb`;
}

export function ModelViewer() {
  const species = useSearchParams().get("species") ?? "cockatiel";
  const hostRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const [clips, setClips] = useState<string[]>([]);
  const [active, setActive] = useState("Idle");

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 50);
    camera.position.set(1.6, 1.3, 2.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;
    controls.update();

    scene.add(new THREE.HemisphereLight("#FFF7E6", "#C9B79C", 2.2));
    const sun = new THREE.DirectionalLight("#FFFFFF", 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 48),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    let mixer: THREE.AnimationMixer | null = null;
    new GLTFLoader().load(modelUrl(species), (gltf) => {
      scene.add(gltf.scene);
      mixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) {
        const action = mixer.clipAction(clip);
        if (clip.name !== "Idle") action.setLoop(THREE.LoopRepeat, Infinity);
        actionsRef.current[clip.name] = action;
      }
      const startClip = new URLSearchParams(window.location.search).get("clip") ?? "Idle";
      const start = actionsRef.current[startClip] ?? actionsRef.current.Idle;
      start?.play();
      if (start) setActive(start.getClip().name);
      setClips(gltf.animations.map((c) => c.name));
    });

    const clock = new THREE.Clock();
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      mixer?.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // The scene is rebuilt when the species changes (the effect cleans up after itself).
  }, [species]);

  function play(name: string) {
    const next = actionsRef.current[name];
    const prev = actionsRef.current[active];
    if (!next || next === prev) return;
    next.reset().play();
    prev?.crossFadeTo(next, 0.2, false);
    setActive(name);
  }

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SPECIES.map((name) => (
          <a
            key={name}
            href={`?species=${name}`}
            className={`rounded-2xl px-3 py-1.5 text-sm font-semibold ${
              species === name ? "bg-[#2B1F16] text-white" : "bg-white/90 text-[#2B1F16]"
            }`}>
            {name}
          </a>
        ))}
      </div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {clips.map((name) => (
          <button
            key={name}
            onClick={() => play(name)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-[0_3px_0_#E09E00] ${
              active === name ? "bg-[#FFC53D]" : "bg-white"
            }`}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
