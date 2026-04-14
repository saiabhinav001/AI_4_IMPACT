"use client";

import { useEffect, useRef } from "react";

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const mouse = { x: -1000, y: -1000 };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseX: number;
      baseY: number;
      size: number;
      density: number;
      color: string;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.baseX = x;
        this.baseY = y;
        this.size = Math.random() * 2.5 + 1.2;
        this.density = Math.random() * 20 + 2;
        this.color = Math.random() > 0.5 ? "#8D36D5" : "#00FFFF";
      }

      draw() {
        if (!ctx) return;
        
        // 1. Draw Halo (Pass 1 - Performance optimized bloom)
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 2. Draw Core (Pass 2 - Crisp particle)
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0; // Reset
      }

      update() {
        // 1. Mouse Interaction (Repulsion)
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 180;

        if (distance < maxDistance) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          // Push particles away with inertia
          this.vx -= Math.cos(angle) * force * (this.density / 2);
          this.vy -= Math.sin(angle) * force * (this.density / 2);
        }

        // 2. Return to Base (Spring Force)
        const dxBase = this.baseX - this.x;
        const dyBase = this.baseY - this.y;
        this.vx += dxBase * 0.012;
        this.vy += dyBase * 0.012;

        // 3. Apply Velocity & Friction
        this.vx *= 0.94; // Smoother friction
        this.vy *= 0.94;
        
        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const init = () => {
      particles = [];
      const isMobile = window.innerWidth < 768;
      const divisor = isMobile ? 22000 : 9000;
      const numberOfParticles = Math.min((canvas.width * canvas.height) / divisor, isMobile ? 60 : 250);
      
      for (let i = 0; i < numberOfParticles; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particles.push(new Particle(x, y));
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
        particles[i].update();
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
