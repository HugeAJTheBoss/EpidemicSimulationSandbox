import React, { useEffect, useRef } from 'react';

export default function VirusIcon({
  spread = 0.5,
  sicken = 0.5,
  recovery = 0.2,
  immunityLoss = 0.2,
  fatality = 0.1,
  contagiousness = 0.5,
  size = 200,
}) {
  const cvRef = useRef(null);
  const rafRef = useRef(null);
  const seedsRef = useRef([]);

  useEffect(() => {
    const canvas = cvRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rand = (min, max) => min + Math.random() * (max - min);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    let spikeCount = Math.max(8, Math.round(20 + spread * 60));
    if (!seedsRef.current || seedsRef.current.length < spikeCount || seedsRef.current.length > spikeCount) {

      seedsRef.current = Array.from({ length: spikeCount }, () => ({
        lenOffset: rand(-6, 6),
        angleOffset: rand(-0.03, 0.03),
        tipScale: rand(0.85, 1.18),
      }));
    }


    const draw = (t) => {
      const time = t / 1000;
      spikeCount = Math.max(8, Math.round(20 + spread * 60));

      const spikeLenBase = 8 + spread * 48 + contagiousness * 20;
      const pulse = 1 + Math.sin(time * (0.6 + contagiousness * 0.8)) * 0.05 * contagiousness;
      const spikeLen = spikeLenBase * pulse;
      const spikeBaseWidth = 1 + contagiousness * 3 + fatality * 4;

      const sickHue = 0;
      const recHue = 120;
      const hue = Math.round((sickHue * sicken + recHue * recovery) / Math.max(sicken + recovery, 0.001));
      const coreSat = clamp(70 + sicken * 30, 40, 100);
      const coreLight = clamp(45 - fatality * 20, 20, 65);

      const glowAlpha = clamp(0.08 + contagiousness * 0.4, 0.06, 0.9);
      const glowRadius = 20 + contagiousness * 80 * pulse;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);

      const rgb = hslToRgb(hue, coreSat, coreLight);
      const g = ctx.createRadialGradient(0, 0, spikeLen * 0.3, 0, 0, spikeLen + glowRadius);
      g.addColorStop(0, `rgba(${rgb.join(',')},${glowAlpha})`);
      g.addColorStop(1, `rgba(10,12,20,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, spikeLen + glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const baseRadius = size * 0.14;

      for (let i = 0; i < spikeCount; i++) {
        const seed = seedsRef.current[i] || { lenOffset: 0, angleOffset: 0, tipScale: 1 };
        const angle = (i / spikeCount) * Math.PI * 2 + seed.angleOffset;
        const x1 = Math.cos(angle) * baseRadius;
        const y1 = Math.sin(angle) * baseRadius;
        const x2 = Math.cos(angle) * (baseRadius + spikeLen + seed.lenOffset);
        const y2 = Math.sin(angle) * (baseRadius + spikeLen + seed.lenOffset);

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const spikeHue = hue + rand(-8, 8);
        grad.addColorStop(0, `hsla(${spikeHue},${coreSat}%,${coreLight}%,1)`);
        grad.addColorStop(1, `hsla(${spikeHue},${coreSat}%,${Math.max(coreLight - 15, 10)}%,0.06)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = spikeBaseWidth * (0.9 + (pulse - 1) * 0.6) * (0.9 + (seed.tipScale - 1) * 0.25);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        const tipR = (1.6 + contagiousness * 2.6) * seed.tipScale * (0.95 + (pulse - 1) * 0.6);
        ctx.fillStyle = `hsla(${spikeHue},${coreSat}%,${coreLight}%,${0.9 - fatality * 0.7})`;
        ctx.arc(x2, y2, tipR, 0, Math.PI * 2);
        ctx.fill();
      }

      const coreR = size * 0.12 * (0.98 + 0.045 * (pulse - 1));
      const cg = ctx.createRadialGradient(0, 0, coreR * 0.2, 0, 0, coreR * 1.1);
      cg.addColorStop(0, `rgba(${rgb.join(',')},${0.95 + (pulse - 1) * 0.2})`);
      cg.addColorStop(0.6, `rgba(${rgb.join(',')},${0.95 - fatality * 0.4})`);
      cg.addColorStop(1, `rgba(10,12,20,0.25)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      const speckCount = Math.round(30 + immunityLoss * 160);
      for (let i = 0; i < speckCount; i++) {
        const r = rand(0, coreR);
        const a = (i * 137.508) % (Math.PI * 2);
        const sx = Math.cos(a) * r * (0.6 + ((i % 7) / 10));
        const sy = Math.sin(a) * r * (0.6 + ((i % 5) / 10));
        const s = (0.6 + immunityLoss) * (0.4 + ((i % 9) / 20));
        ctx.fillStyle = `rgba(0,0,0,${(0.06 + immunityLoss * 0.22) * (0.9 + (pulse - 1) * 0.5)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      }

      const spots = Math.round(1 + fatality * 6);
      for (let i = 0; i < spots; i++) {
        const ang = (i * 2.3) % (Math.PI * 2);
        const rr = (i * 0.37 % 0.7) * coreR;
        const sx = Math.cos(ang) * rr;
        const sy = Math.sin(ang) * rr;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + fatality * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2 + fatality * 6, 1 + fatality * 3, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }

      const pcount = Math.round(8 + contagiousness * 40);
      for (let i = 0; i < pcount; i++) {
        const angle = (i / pcount) * Math.PI * 2;
        const rr = coreR + spikeLen * 0.5 + (i % 3) * 6;
        const px = Math.cos(angle) * rr;
        const py = Math.sin(angle) * rr;
        const pr = 0.8 + (i % 4) * 0.6;
        ctx.fillStyle = `rgba(${rgb.join(',')},${(0.06 + contagiousness * 0.4) * (0.85 + (pulse - 1) * 0.9)})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spread, sicken, recovery, immunityLoss, fatality, contagiousness, size]);

  return <canvas ref={cvRef} className={contagiousness > 0.6 ? 'virus-pulse' : ''} style={{ display: 'block' }} />;
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}