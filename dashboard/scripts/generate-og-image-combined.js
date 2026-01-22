const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#09090b';
ctx.fillRect(0, 0, width, height);

// Subtle grid pattern
ctx.strokeStyle = '#18181b';
ctx.lineWidth = 1;
for (let x = 0; x < width; x += 50) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}
for (let y = 0; y < height; y += 50) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

// Purple glow behind gauge
const gaugeGlow = ctx.createRadialGradient(300, 350, 0, 300, 350, 250);
gaugeGlow.addColorStop(0, 'rgba(124, 58, 237, 0.25)');
gaugeGlow.addColorStop(1, 'rgba(124, 58, 237, 0)');
ctx.fillStyle = gaugeGlow;
ctx.fillRect(0, 0, width, height);

// ===== LEFT SIDE: GAUGE =====
const gaugeX = 280;
const gaugeY = 360;
const radius = 130;

// Background arc
ctx.beginPath();
ctx.arc(gaugeX, gaugeY, radius, Math.PI, 0, false);
ctx.lineWidth = 18;
ctx.strokeStyle = '#27272a';
ctx.lineCap = 'round';
ctx.stroke();

// Filled arc
const arcGradient = ctx.createLinearGradient(gaugeX - radius, gaugeY, gaugeX + radius, gaugeY);
arcGradient.addColorStop(0, '#4b5563');
arcGradient.addColorStop(0.5, '#7c3aed');
arcGradient.addColorStop(1, '#a855f7');

ctx.beginPath();
ctx.arc(gaugeX, gaugeY, radius, Math.PI, Math.PI * 0.2, false);
ctx.lineWidth = 18;
ctx.strokeStyle = arcGradient;
ctx.lineCap = 'round';
ctx.stroke();

// Tick marks
[0, 0.25, 0.5, 0.75, 1].forEach(tick => {
  const angle = Math.PI - (tick * Math.PI);
  const innerR = radius - 28;
  const outerR = radius - 12;
  const x1 = gaugeX + innerR * Math.cos(angle);
  const y1 = gaugeY - innerR * Math.sin(angle);
  const x2 = gaugeX + outerR * Math.cos(angle);
  const y2 = gaugeY - outerR * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#52525b';
  ctx.lineCap = 'round';
  ctx.stroke();
});

// Needle
const needleAngle = Math.PI * 0.28;
const needleLength = radius - 25;
const needleX = gaugeX + needleLength * Math.cos(needleAngle);
const needleY = gaugeY - needleLength * Math.sin(needleAngle);

ctx.beginPath();
ctx.moveTo(gaugeX, gaugeY);
ctx.lineTo(needleX, needleY);
ctx.lineWidth = 3;
ctx.strokeStyle = '#a855f7';
ctx.lineCap = 'round';
ctx.stroke();

// Center dots
ctx.beginPath();
ctx.arc(gaugeX, gaugeY, 10, 0, Math.PI * 2);
ctx.fillStyle = '#a855f7';
ctx.fill();

ctx.beginPath();
ctx.arc(gaugeX, gaugeY, 5, 0, Math.PI * 2);
ctx.fillStyle = '#09090b';
ctx.fill();

// Gauge label
ctx.fillStyle = '#a1a1aa';
ctx.font = '16px system-ui, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('5.4M tokens', gaugeX, gaugeY - 40);

// ===== RIGHT SIDE: LEADERBOARD =====
const barStartX = 580;
const barStartY = 200;
const barHeight = 32;
const barGap = 48;
const maxBarWidth = 450;

const barData = [
  { width: 0.92, rank: 1, name: '' },
  { width: 0.68, rank: 2, name: '' },
  { width: 0.52, rank: 3, name: '' },
  { width: 0.38, rank: 4, name: '' },
  { width: 0.25, rank: 5, name: '' },
];

barData.forEach((bar, i) => {
  const y = barStartY + i * barGap;

  // Bar background
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.roundRect(barStartX, y, maxBarWidth, barHeight, 6);
  ctx.fill();

  // Bar fill
  const barGradient = ctx.createLinearGradient(barStartX, 0, barStartX + maxBarWidth * bar.width, 0);
  if (i === 0) {
    barGradient.addColorStop(0, '#7c3aed');
    barGradient.addColorStop(1, '#a855f7');
  } else if (i === 1) {
    barGradient.addColorStop(0, '#52525b');
    barGradient.addColorStop(1, '#71717a');
  } else if (i === 2) {
    barGradient.addColorStop(0, '#b45309');
    barGradient.addColorStop(1, '#d97706');
  } else {
    barGradient.addColorStop(0, '#3f3f46');
    barGradient.addColorStop(1, '#52525b');
  }

  ctx.fillStyle = barGradient;
  ctx.beginPath();
  ctx.roundRect(barStartX, y, maxBarWidth * bar.width, barHeight, 6);
  ctx.fill();

  // Rank circle
  const circleX = barStartX - 35;
  const circleY = y + barHeight / 2;

  ctx.beginPath();
  ctx.arc(circleX, circleY, 14, 0, Math.PI * 2);
  if (i === 0) ctx.fillStyle = '#7c3aed';
  else if (i === 1) ctx.fillStyle = '#52525b';
  else if (i === 2) ctx.fillStyle = '#b45309';
  else ctx.fillStyle = '#3f3f46';
  ctx.fill();

  // Rank number
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(bar.rank), circleX, circleY);
});

// ===== TITLE =====
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 56px system-ui, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Claudometer', width / 2, 70);

// Subtitle
ctx.fillStyle = '#a1a1aa';
ctx.font = '24px system-ui, sans-serif';
ctx.fillText('Team leaderboards for Claude Code', width / 2, 120);

// Bottom tagline
ctx.fillStyle = '#52525b';
ctx.font = '18px system-ui, sans-serif';
ctx.fillText('Tokens • Messages • Commits • Lines of Code', width / 2, height - 40);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, '../public/og-image-combined.png'), buffer);
console.log('Generated combined OG image');
