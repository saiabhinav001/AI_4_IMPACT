"use client";

import { useEffect, useRef } from "react";

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseX: number;
      baseY: number;
      size: number;
      density: number;
      color: string;
    };

    const createParticle = (x: number, y: number): Particle => ({
      x,
      y,
      vx: 0,
      vy: 0,
      baseX: x,
      baseY: y,
      size: Math.random() * 2.5 + 1.2,
      density: Math.random() * 20 + 2,
      color: Math.random() > 0.5 ? "#8D36D5" : "#00FFFF",
    });

    const drawParticle = (particle: Particle) => {
      if (!ctx) return;

      // 1. Draw Halo (Pass 1 - Performance optimized bloom)
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw Core (Pass 2 - Crisp particle)
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1.0;
    };

    const updateParticle = (particle: Particle) => {
      // 1. Mouse Interaction (Repulsion)
      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 180;

      if (distance < maxDistance) {
        const force = (maxDistance - distance) / maxDistance;
        const angle = Math.atan2(dy, dx);
        // Push particles away with inertia
        particle.vx -= Math.cos(angle) * force * (particle.density / 2);
        particle.vy -= Math.sin(angle) * force * (particle.density / 2);
      }

      // 2. Return to Base (Spring Force)
      const dxBase = particle.baseX - particle.x;
      const dyBase = particle.baseY - particle.y;
      particle.vx += dxBase * 0.012;
      particle.vy += dyBase * 0.012;

      // 3. Apply Velocity & Friction
      particle.vx *= 0.94;
      particle.vy *= 0.94;

      particle.x += particle.vx;
      particle.y += particle.vy;
    };

    let animationFrameId: number;
    let particles: Particle[] = [];
    const mouse = { x: -1000, y: -1000 };

    const init = () => {
      particles = [];
      const isMobile = window.innerWidth < 768;
      const divisor = isMobile ? 22000 : 9000;
      const numberOfParticles = Math.min((canvas.width * canvas.height) / divisor, isMobile ? 60 : 250);
      
      for (let i = 0; i < numberOfParticles; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particles.push(createParticle(x, y));
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        drawParticle(particles[i]);
        updateParticle(particles[i]);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    handleResize();
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] pointer-events-none opacity-[0.4]"
    />
  );
}
