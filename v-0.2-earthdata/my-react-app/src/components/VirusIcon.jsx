import React, { useEffect, useRef } from 'react';
//controls the virus that shows up in the virus panel!!
export default function VirusIcon(props) {
  const {
    spread = 0.5,
    sicken = 0.5,
    recovery = 0.2,
    immunityLoss = 0.2,
    fatality = 0.1,
    contagiousness = 0.5,
    size = 200,
  } = props;
//these are base values (completely arbitrary)
  const cvRef = useRef(null);
  const raf = useRef(null);
  const seeds = useRef([]);

  useEffect(() => {
    const canvas = cvRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    let spikeCount = Math.max(8, Math.round(20 + spread * 60));
//amount of seeds inside the virus
    if (!seeds.current || seeds.current.length !== spikeCount) {
      seeds.current = Array(spikeCount)
        .fill(0)
        .map(() => ({
          lenOffset: rand(-6, 6),
          angleOffset: rand(-0.03, 0.03),
          tipScale: rand(0.85, 1.18),
        }));
    }
//makes the spikes around the circle
//Also the color, size etc. of the virus
    const draw = (t) => {
      const time = t * 0.001;
      spikeCount = Math.max(8, Math.round(20 + spread * 60));

      const spikeLenBase = 8 + spread * 48 + contagiousness * 20;
      const pulse =
        1 +
        Math.sin(time * (0.6 + contagiousness * 0.8)) *
          0.05 *
          contagiousness;

      const spikeLen = spikeLenBase * pulse;
      const spikeBaseWidth = 1 + contagiousness * 3 + fatality * 4;

      const hue =
        Math.round(
          (0 * sicken + 120 * recovery) /
            Math.max(sicken + recovery, 0.001)
        ) || 0;

      const coreSat = clamp(70 + sicken * 30, 40, 100);
      const coreLight = clamp(45 - fatality * 20, 20, 65);

      const glowAlpha = clamp(0.08 + contagiousness * 0.4, 0.06, 0.9);
      const glowRadius = 20 + contagiousness * 80 * pulse;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);

      const rgb = coloring(hue, coreSat, coreLight);

      const bg = ctx.createRadialGradient(
        0,
        0,
        spikeLen * 0.3,
        0,
        0,
        spikeLen + glowRadius
      );
      bg.addColorStop(0, `rgba(${rgb.join(',')},${glowAlpha})`);
      bg.addColorStop(1, 'rgba(10,12,20,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, spikeLen + glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const baseR = size * 0.14;

      for (let i = 0; i < spikeCount; i++) {
        const seed = seeds.current[i] || {};
        const ang =
          (i / spikeCount) * Math.PI * 2 + (seed.angleOffset || 0);

        const x1 = Math.cos(ang) * baseR;
        const y1 = Math.sin(ang) * baseR;
        const x2 =
          Math.cos(ang) *
          (baseR + spikeLen + (seed.lenOffset || 0));
        const y2 =
          Math.sin(ang) *
          (baseR + spikeLen + (seed.lenOffset || 0));

        const spikeHue = hue + rand(-8, 8);
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(
          0,
          `hsla(${spikeHue},${coreSat}%,${coreLight}%,1)`
        );
        grad.addColorStop(
          1,
          `hsla(${spikeHue},${coreSat}%,${Math.max(
            coreLight - 15,
            10
          )}%,0.06)`
        );

        ctx.strokeStyle = grad;
        ctx.lineWidth =
          spikeBaseWidth *
          (0.9 + (pulse - 1) * 0.6) *
          (0.9 + ((seed.tipScale || 1) - 1) * 0.25);

        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const tipR =
          (1.6 + contagiousness * 2.6) *
          (seed.tipScale || 1) *
          (0.95 + (pulse - 1) * 0.6);

        ctx.fillStyle = `hsla(${spikeHue},${coreSat}%,${coreLight}%,${
          0.9 - fatality * 0.7
        })`;
        ctx.beginPath();
        ctx.arc(x2, y2, tipR, 0, Math.PI * 2);
        ctx.fill();
      }

      const coreR = size * 0.12 * (0.98 + 0.045 * (pulse - 1));
      const cg = ctx.createRadialGradient(
        0,
        0,
        coreR * 0.2,
        0,
        0,
        coreR * 1.1
      );

      cg.addColorStop(
        0,
        `rgba(${rgb.join(',')},${0.95 + (pulse - 1) * 0.2})`
      );
      cg.addColorStop(
        0.6,
        `rgba(${rgb.join(',')},${0.95 - fatality * 0.4})`
      );
      cg.addColorStop(1, 'rgba(10,12,20,0.25)');

      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      const specks = Math.round(30 + immunityLoss * 160);
      for (let i = 0; i < specks; i++) {
        const r = rand(0, coreR);
        const a = (i * 137.508) % (Math.PI * 2);
        const sx = Math.cos(a) * r * (0.6 + ((i % 7) / 10));
        const sy = Math.sin(a) * r * (0.6 + ((i % 5) / 10));
        const sr = (0.6 + immunityLoss) * (0.4 + ((i % 9) / 20));
        ctx.fillStyle = `rgba(0,0,0,${
          (0.06 + immunityLoss * 0.22) *
          (0.9 + (pulse - 1) * 0.5)
        })`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      const spots = Math.round(1 + fatality * 6);
      for (let i = 0; i < spots; i++) {
        const a = (i * 2.3) % (Math.PI * 2);
        const rr = ((i * 0.37) % 0.7) * coreR;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + fatality * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * rr,
          Math.sin(a) * rr,
          2 + fatality * 6,
          1 + fatality * 3,
          Math.random() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      const pcount = Math.round(8 + contagiousness * 40);
      for (let i = 0; i < pcount; i++) {
        const a = (i / pcount) * Math.PI * 2;
        const rr = coreR + spikeLen * 0.5 + (i % 3) * 6;
        ctx.fillStyle = `rgba(${rgb.join(',')},${
          (0.06 + contagiousness * 0.4) *
          (0.85 + (pulse - 1) * 0.9)
        })`;
        ctx.beginPath();
        ctx.arc(
          Math.cos(a) * rr,
          Math.sin(a) * rr,
          0.8 + (i % 4) * 0.6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [
    spread,
    sicken,
    recovery,
    immunityLoss,
    fatality,
    contagiousness,
    size,
  ]);

  return (
    <canvas
      ref={cvRef}
      className={contagiousness > 0.6 ? 'virus-pulse' : ''}
      style={{ display: 'block' }}
    />
  );
}
//determines coloring based on values
//will hopefully be made more realistic in the future or cooler at least
function coloring(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}
//hope to add different shapes and more customizing for different virus types hopefully (nice to have not need to have)
