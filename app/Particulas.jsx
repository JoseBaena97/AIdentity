"use client";

import { useEffect, useRef } from "react";

const AREA_POR_PARTICULA = 9000; // px² por partícula: controla la densidad
const RADIO_RATON = 140; // px: zona de influencia del cursor
const FUERZA_REPULSION = 0.6;
const DISTANCIA_LINEA = 110; // px: distancia máxima para unir dos partículas

// Modo "pensando" (mientras la IA analiza): las partículas se disparan como neuronas
const PROB_DISPARO = 0.006; // probabilidad por partícula y frame de dispararse sola
const PROB_PROPAGACION = 0.4; // probabilidad de que un disparo encienda a una vecina
const REFRACTARIO = 45; // frames de descanso tras dispararse

// Fondo de partículas que flotan despacio y se apartan del ratón.
// Con `activo` se encienden y propagan impulsos como una red neuronal.
// Es un canvas fijo detrás del contenido que no intercepta clics.
export default function Particulas({ activo = false }) {
  const canvasRef = useRef(null);
  const activoRef = useRef(activo);

  // Se guarda en una ref para no reiniciar la animación cada vez que cambia
  useEffect(() => {
    activoRef.current = activo;
  }, [activo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raton = { x: -9999, y: -9999 };
    let particulas = [];
    let ancho = 0;
    let alto = 0;
    let color = "";
    let colorBrillo = "";
    let intensidad = 0; // 0 = reposo, 1 = pensando a tope; transiciona suavemente
    let frame = 0;

    const actualizarColor = () => {
      const oscuro = document.documentElement.classList.contains("dark");
      color = oscuro ? "255, 255, 255" : "24, 24, 27";
      colorBrillo = oscuro ? "125, 211, 252" : "2, 132, 199"; // azul del logo
    };

    const crearParticulas = () => {
      const cantidad = Math.round((ancho * alto) / AREA_POR_PARTICULA);
      particulas = Array.from({ length: cantidad }, () => {
        const angulo = Math.random() * Math.PI * 2;
        const velocidad = 0.08 + Math.random() * 0.15;
        const bvx = Math.cos(angulo) * velocidad;
        const bvy = Math.sin(angulo) * velocidad;
        return {
          x: Math.random() * ancho,
          y: Math.random() * alto,
          vx: bvx,
          vy: bvy,
          bvx, // velocidad de deriva a la que vuelve la partícula
          bvy,
          r: 0.8 + Math.random() * 1.2,
          brillo: 0, // 0..1: cuánto está "encendida"
          refractario: 0, // frames que faltan para poder volver a dispararse
          pendiente: 0, // frames que faltan para dispararse por propagación (0 = nada)
          origen: null, // partícula que le propagó el impulso (para dibujar la sinapsis)
        };
      });
    };

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = window.innerWidth;
      alto = window.innerHeight;
      canvas.width = ancho * dpr;
      canvas.height = alto * dpr;
      canvas.style.width = `${ancho}px`;
      canvas.style.height = `${alto}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      crearParticulas();
      if (sinMovimiento) dibujar();
    };

    const disparar = (p) => {
      p.brillo = 1;
      p.refractario = REFRACTARIO;
      p.pendiente = 0;
      // El impulso puede saltar a vecinas cercanas unos frames después
      for (const v of particulas) {
        if (v === p || v.refractario > 0 || v.pendiente > 0) continue;
        if (Math.hypot(v.x - p.x, v.y - p.y) < DISTANCIA_LINEA && Math.random() < PROB_PROPAGACION * intensidad) {
          v.pendiente = 6 + Math.floor(Math.random() * 10);
          v.origen = p;
        }
      }
    };

    const mover = () => {
      intensidad += ((activoRef.current ? 1 : 0) - intensidad) * 0.03;

      for (const p of particulas) {
        const dx = p.x - raton.x;
        const dy = p.y - raton.y;
        const dist = Math.hypot(dx, dy);
        if (dist < RADIO_RATON && dist > 0) {
          const fuerza = (1 - dist / RADIO_RATON) * FUERZA_REPULSION;
          p.vx += (dx / dist) * fuerza;
          p.vy += (dy / dist) * fuerza;
        }
        // Amortiguación: la partícula recupera poco a poco su deriva original
        p.vx += (p.bvx - p.vx) * 0.04;
        p.vy += (p.bvy - p.vy) * 0.04;
        p.x += p.vx;
        p.y += p.vy;

        // Al salir por un borde reaparece por el opuesto
        if (p.x < -10) p.x = ancho + 10;
        else if (p.x > ancho + 10) p.x = -10;
        if (p.y < -10) p.y = alto + 10;
        else if (p.y > alto + 10) p.y = -10;

        // Actividad neuronal
        p.brillo *= 0.94;
        if (p.refractario > 0) p.refractario--;
        if (p.pendiente > 0 && --p.pendiente === 0) disparar(p);
        else if (p.refractario === 0 && Math.random() < PROB_DISPARO * intensidad) disparar(p);
        if (p.brillo < 0.05) p.origen = null;
      }
    };

    const dibujar = () => {
      ctx.clearRect(0, 0, ancho, alto);

      // Sinapsis: línea entre una neurona encendida y la que le pasó el impulso
      ctx.lineWidth = 0.8;
      for (const p of particulas) {
        if (!p.origen || p.brillo < 0.05) continue;
        ctx.strokeStyle = `rgba(${colorBrillo}, ${p.brillo * 0.6})`;
        ctx.beginPath();
        ctx.moveTo(p.origen.x, p.origen.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Partículas; solo se unen con líneas las cercanas al cursor
      const cercanas = [];
      for (const p of particulas) {
        const distRaton = Math.hypot(p.x - raton.x, p.y - raton.y);
        const alfa = distRaton < RADIO_RATON * 1.5 ? 0.55 : 0.22;
        if (distRaton < RADIO_RATON * 1.5) cercanas.push(p);

        ctx.fillStyle = `rgba(${color}, ${alfa * (1 - p.brillo)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        if (p.brillo > 0.02) {
          // Halo + núcleo brillante
          ctx.fillStyle = `rgba(${colorBrillo}, ${p.brillo * 0.15})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (2 + p.brillo * 6), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${colorBrillo}, ${Math.min(1, p.brillo + 0.2)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 + p.brillo), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.lineWidth = 0.6;
      for (let i = 0; i < cercanas.length; i++) {
        for (let j = i + 1; j < cercanas.length; j++) {
          const a = cercanas[i];
          const b = cercanas[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < DISTANCIA_LINEA) {
            ctx.strokeStyle = `rgba(${color}, ${(1 - dist / DISTANCIA_LINEA) * 0.25})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const bucle = () => {
      mover();
      dibujar();
      frame = requestAnimationFrame(bucle);
    };

    const alMoverRaton = (e) => {
      raton.x = e.clientX;
      raton.y = e.clientY;
    };
    const alSalirRaton = () => {
      raton.x = -9999;
      raton.y = -9999;
    };
    const alCambiarVisibilidad = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !sinMovimiento) frame = requestAnimationFrame(bucle);
    };

    // Detecta el cambio de tema (clase .dark en <html>) para recolorear al instante
    const observador = new MutationObserver(() => {
      actualizarColor();
      if (sinMovimiento) dibujar();
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    actualizarColor();
    redimensionar();
    if (!sinMovimiento) frame = requestAnimationFrame(bucle);

    window.addEventListener("resize", redimensionar);
    window.addEventListener("pointermove", alMoverRaton);
    document.documentElement.addEventListener("pointerleave", alSalirRaton);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelAnimationFrame(frame);
      observador.disconnect();
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", alMoverRaton);
      document.documentElement.removeEventListener("pointerleave", alSalirRaton);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" />;
}
