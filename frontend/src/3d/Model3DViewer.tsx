import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

interface Model3DViewerProps {
  modelPath: string;
  backgroundColor?: string;
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({
  modelPath,
  backgroundColor = '#f5f5f5',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Evitar doble inicialización
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ============ ESCENA ============
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // ============ CÁMARA ============
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    // ============ RENDERER ============
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ============ ILUMINACIÓN ============
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // ============ CARGAR MODELO ============
    const loader = new GLTFLoader();
    console.log('🔄 Cargando modelo desde:', modelPath);

    loader.load(
      modelPath,
      (gltf) => {
        console.log('✅ Modelo cargado');
        
        // Crear grupo para el modelo
        const modelGroup = new THREE.Group();
        
        // Copiar todas las geometrías y materiales del modelo
        gltf.scene.children.forEach(child => {
          modelGroup.add(child.clone(true));
        });

        // Calcular bounding box
        const box = new THREE.Box3().setFromObject(modelGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        console.log('📏 Tamaño:', { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) });

        // Centrar todo en el origen
        modelGroup.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.position.sub(center);
          }
        });

        // Escalar
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4 / maxDim;
        modelGroup.scale.set(scale, scale, scale);

        modelRef.current = modelGroup;
        scene.add(modelGroup);
      },
      undefined,
      (error) => {
        console.error('❌ Error cargando modelo:', error);
      }
    );

    // ============ ROTACIÓN CON RATÓN ============
    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !modelRef.current) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      modelRef.current.rotation.y += deltaX * 0.01;
      modelRef.current.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseUp);

    // ============ ANIMACIÓN ============
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // ============ RESIZE ============
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // ============ CLEANUP ============
    return () => {
      console.log('🧹 Limpiando visualizador 3D');
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mouseleave', onMouseUp);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      initRef.current = false;
    };
  }, [modelPath, backgroundColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'radial-gradient(circle at 50% 50%, #6ea8e6 0%, #a7ccef 42%, #d8e9f8 78%, #ffffff 100%)',
      }}
    />
  );
};
