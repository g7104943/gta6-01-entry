// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the player through Solmar; the renderer paints the visible
// slice of the city, every car and person in it, the HUD (cash, health, wanted
// stars, minimap, objective) and the menu panels. Flat shapes, warm colours,
// canvas text — no images, no network.

import { CAR, CITY, FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { currentMission, currentStage, stageText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const ROOFS = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3, PALETTE.buildingRoof4];
const MINIMAP = { x: FIELD.width - 216, y: 16, w: 200, h: 145 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.dpr = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h, edge) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = edge || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawCity(state) {
    const city = state.city;
    const cam = state.camera;
    const vx0 = cam.x - FIELD.width / 2 - 40;
    const vy0 = cam.y - FIELD.height / 2 - 40;
    const vx1 = cam.x + FIELD.width / 2 + 40;
    const vy1 = cam.y + FIELD.height / 2 + 40;

    // Ground: grass everywhere, sand on the beach, water in the bay.
    context.fillStyle = PALETTE.grass;
    context.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    context.fillStyle = PALETTE.sand;
    context.fillRect(vx0, Math.max(vy0, CITY.beachY), vx1 - vx0, Math.min(vy1, CITY.waterY) - Math.max(vy0, CITY.beachY));
    context.fillStyle = PALETTE.water;
    context.fillRect(vx0, Math.max(vy0, CITY.waterY), vx1 - vx0, vy1 - Math.max(vy0, CITY.waterY));
    context.fillStyle = PALETTE.waterDeep;
    for (let wx = Math.floor(vx0 / 180) * 180; wx < vx1; wx += 180) {
      context.fillRect(wx, CITY.waterY + 40, 90, 6);
      context.fillRect(wx + 60, CITY.waterY + 110, 90, 6);
    }

    // Parks.
    for (const p of city.parks) {
      context.fillStyle = PALETTE.parkGrass;
      context.fillRect(p.x, p.y, p.w, p.h);
      context.fillStyle = '#3d7a35';
      for (let i = 0; i < 8; i += 1) {
        const tx = p.x + 30 + ((i * 47) % (p.w - 60));
        const ty = p.y + 30 + ((i * 83) % (p.h - 60));
        context.beginPath();
        context.arc(tx, ty, 14, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Sidewalks: pale strips hugging each road.
    context.fillStyle = PALETTE.sidewalk;
    for (const x of city.vertical) {
      context.fillRect(x - CITY.roadWidth / 2 - CITY.sidewalk, vy0, CITY.sidewalk, vy1 - vy0);
      context.fillRect(x + CITY.roadWidth / 2, vy0, CITY.sidewalk, vy1 - vy0);
    }
    for (const y of city.horizontal) {
      context.fillRect(vx0, y - CITY.roadWidth / 2 - CITY.sidewalk, vx1 - vx0, CITY.sidewalk);
      context.fillRect(vx0, y + CITY.roadWidth / 2, vx1 - vx0, CITY.sidewalk);
    }

    // Roads with dashed centre lines.
    context.fillStyle = PALETTE.road;
    for (const x of city.vertical) context.fillRect(x - CITY.roadWidth / 2, vy0, CITY.roadWidth, vy1 - vy0);
    for (const y of city.horizontal) context.fillRect(vx0, y - CITY.roadWidth / 2, vx1 - vx0, CITY.roadWidth);
    context.fillStyle = PALETTE.roadLine;
    for (const x of city.vertical) {
      for (let y = Math.floor(vy0 / 60) * 60; y < vy1; y += 60) {
        if (y > CITY.beachY) break;
        context.fillRect(x - 2, y, 4, 30);
      }
    }
    for (const y of city.horizontal) {
      for (let x = Math.floor(vx0 / 60) * 60; x < vx1; x += 60) {
        context.fillRect(x, y - 2, 30, 4);
      }
    }

    // Buildings: shadow, roof, edge, and a lighter roof detail.
    for (const b of city.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(b.x + 6, b.y + b.height * 0.4 + 6, b.w, b.h);
      context.fillStyle = ROOFS[b.roof];
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.18)';
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, 14);
    }

    // Landmark labels, drawn small on the road so the city reads as a place.
    textPlain('SOLMAR', 60, 60, 22, 'rgba(255,255,255,0.5)', 'left', 'top');
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      if (lm.x < vx0 || lm.x > vx1 || lm.y < vy0 || lm.y > vy1) continue;
      textPlain(lm.label, lm.x, lm.y - 14, 15, 'rgba(255,255,255,0.85)', 'center', 'bottom');
    }
  }

  function drawCarShape(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.dead) {
      context.fillStyle = '#222222';
    } else {
      context.fillStyle = car.color;
    }
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 2;
    context.stroke();
    // Windshield and rear window.
    context.fillStyle = car.dead ? '#111111' : '#9fc4dd';
    context.fillRect(CAR.length / 2 - 22, -CAR.width / 2 + 5, 12, CAR.width - 10);
    context.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 5, 10, CAR.width - 10);
    // Wheels.
    context.fillStyle = '#111111';
    context.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 - 3, 12, 5);
    context.fillRect(-CAR.length / 2 + 8, CAR.width / 2 - 2, 12, 5);
    context.fillRect(CAR.length / 2 - 20, -CAR.width / 2 - 3, 12, 5);
    context.fillRect(CAR.length / 2 - 20, CAR.width / 2 - 2, 12, 5);
    if (car.brakeLight) {
      context.fillStyle = '#ff2e2e';
      context.fillRect(-CAR.length / 2 - 2, -CAR.width / 2 + 4, 4, 8);
      context.fillRect(-CAR.length / 2 - 2, CAR.width / 2 - 12, 4, 8);
    }
    if (car.kind === 'police' && !car.dead) {
      const phase = Math.floor(car.sirenPhase) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#2f7bff';
      context.beginPath();
      context.arc(0, -6, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = phase ? '#2f7bff' : '#ff3b30';
      context.beginPath();
      context.arc(0, 6, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.markerRing;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
      context.stroke();
    }
    context.restore();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    context.rotate(ped.angle);
    context.fillStyle = ped.hitFlash > 0 ? '#ffffff' : ped.pants;
    context.fillRect(-4, -6, 8, 12);
    context.fillStyle = ped.hitFlash > 0 ? '#ffffff' : ped.shirt;
    context.beginPath();
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.skin;
    context.beginPath();
    context.arc(5, 0, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.car) return; // the car shape carries the player
    context.save();
    context.translate(player.x, player.y);
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) context.globalAlpha = 0.4;
    context.rotate(player.aim);
    // Body: yellow shirt, facing the aim; a dark pistol line when shooting.
    context.fillStyle = PALETTE.playerShirt;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#7a2d28';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = '#2c2f36';
    context.fillRect(PLAYER.radius - 2, -2, 14, 4);
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(4, 0, 5.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMarker(state) {
    const marker = state.marker;
    if (!marker) return;
    const cam = state.camera;
    const dx = marker.x - cam.x;
    const dy = marker.y - cam.y;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // On-screen: a pink diamond that bobs over the target.
    if (Math.abs(dx) < FIELD.width / 2 - 60 && Math.abs(dy) < FIELD.height / 2 - 60) {
      const y = marker.y - 34 + Math.sin(state.time * 3) * 4;
      context.save();
      context.translate(marker.x, y);
      context.scale(pulse, pulse);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.marker;
      context.fillRect(-9, -9, 18, 18);
      context.strokeStyle = PALETTE.markerRing;
      context.lineWidth = 2;
      context.strokeRect(-9, -9, 18, 18);
      context.restore();
      return;
    }
    // Off-screen: an arrow on the screen edge pointing at it.
    const angle = Math.atan2(dy, dx);
    const ex = cam.x + Math.cos(angle) * (FIELD.width / 2 - 70);
    const ey = cam.y + Math.sin(angle) * (FIELD.height / 2 - 70);
    context.save();
    context.translate(ex, ey);
    context.rotate(angle);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-10, -12);
    context.lineTo(-4, 0);
    context.lineTo(-10, 12);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawMinimap(state) {
    const sx = MINIMAP.w / CITY.width;
    const sy = MINIMAP.h / CITY.height;
    context.save();
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.beginPath();
    context.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.clip();
    // Water and park.
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(MINIMAP.x, MINIMAP.y + CITY.waterY * sy, MINIMAP.w, MINIMAP.h - CITY.waterY * sy);
    context.fillStyle = PALETTE.minimapPark;
    for (const p of state.city.parks) {
      context.fillRect(MINIMAP.x + p.x * sx, MINIMAP.y + p.y * sy, p.w * sx, p.h * sy);
    }
    // Roads.
    context.strokeStyle = PALETTE.minimapRoad;
    context.lineWidth = 2;
    for (const x of state.city.vertical) {
      context.beginPath();
      context.moveTo(MINIMAP.x + x * sx, MINIMAP.y);
      context.lineTo(MINIMAP.x + x * sx, MINIMAP.y + CITY.beachY * sy);
      context.stroke();
    }
    for (const y of state.city.horizontal) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + y * sy);
      context.lineTo(MINIMAP.x + CITY.width * sx, MINIMAP.y + y * sy);
      context.stroke();
    }
    // Mission marker, police, player.
    if (state.marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(MINIMAP.x + state.marker.x * sx, MINIMAP.y + state.marker.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#4f8ef7';
    for (const car of state.police.cars) {
      context.beginPath();
      context.arc(MINIMAP.x + car.x * sx, MINIMAP.y + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffd23f';
    context.strokeStyle = '#111111';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 1;
    context.strokeRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
  }

  function drawHud(state, ui) {
    const player = state.player;
    const police = state.police;
    context.save();
    // Top-left: cash and health.
    panel(16, 16, 250, 64, 'rgba(255,255,255,0.25)');
    text('$' + Math.floor(player.money).toLocaleString('en-US'), 30, 44, 26, PALETTE.cash, 'left', 'middle');
    context.fillStyle = '#222222';
    context.fillRect(30, 56, 180, 10);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(30, 56, 180 * Math.max(0, player.health / PLAYER.health), 10);
    textPlain(Math.ceil(player.health) + '', 220, 61, 14, PALETTE.text, 'left', 'middle');
    if (player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * 0.24);
      text(kmh + ' km/h', 30, 100, 22, PALETTE.text, 'left', 'middle');
      context.fillStyle = '#222222';
      context.fillRect(30, 112, 150, 8);
      context.fillStyle = player.car.health > 30 ? '#7bc96f' : '#e5534b';
      context.fillRect(30, 112, 150 * Math.max(0, player.car.health / 100), 8);
    }
    // Top-centre: wanted stars.
    const stars = police.level;
    const starW = 34;
    const totalW = 5 * starW;
    const sx0 = FIELD.width / 2 - totalW / 2;
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(sx0 - 12, 12, totalW + 24, 46);
    for (let i = 0; i < 5; i += 1) {
      drawStar(sx0 + i * starW + starW / 2, 35, 13, i < stars ? PALETTE.star : PALETTE.starEmpty);
    }
    // Minimap.
    drawMinimap(state);
    // Clock under the minimap.
    const hours = Math.floor(state.clock);
    const minutes = Math.floor((state.clock - hours) * 60);
    const clock = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    textPlain(clock + '  SOLMAR', MINIMAP.x + MINIMAP.w, MINIMAP.y + MINIMAP.h + 20, 15, PALETTE.text, 'right', 'middle');
    // Bottom-left: current objective.
    const mission = currentMission(state.missions);
    if (state.missions.active && mission) {
      const obj = stageText(state.missions);
      const timer = currentStageTimer(state.missions);
      panel(16, FIELD.height - 96, 560, 80, 'rgba(255,255,255,0.25)');
      textPlain(`MISSION ${mission.id} — ${mission.title}`, 30, FIELD.height - 72, 16, PALETTE.marker, 'left', 'middle');
      textPlain(obj, 30, FIELD.height - 44, 18, PALETTE.text, 'left', 'middle');
      if (timer) textPlain('⏱ ' + Math.ceil(timer) + 's', 540, FIELD.height - 44, 18, '#ff9d5c', 'right', 'middle');
    } else if (mission) {
      panel(16, FIELD.height - 96, 560, 80, 'rgba(255,255,255,0.25)');
      textPlain('FREE ROAM', 30, FIELD.height - 72, 16, PALETTE.muted, 'left', 'middle');
      textPlain(`Press M to start: ${mission.title}  •  E: enter car  •  F / click: shoot`, 30, FIELD.height - 44, 16, PALETTE.text, 'left', 'middle');
    } else {
      panel(16, FIELD.height - 96, 560, 80, 'rgba(255,255,255,0.25)');
      textPlain('ALL MISSIONS COMPLETE', 30, FIELD.height - 72, 16, PALETTE.cash, 'left', 'middle');
      textPlain('Free roam — Solmar is yours. E: enter car  •  F / click: shoot', 30, FIELD.height - 44, 16, PALETTE.text, 'left', 'middle');
    }
    // Message banner (centre, under the stars).
    if (state.messageTimer > 0 && state.message) {
      const w = Math.min(760, 40 + state.message.length * 9.5);
      panel(FIELD.width / 2 - w / 2, 74, w, 40, 'rgba(255,255,255,0.25)');
      textPlain(state.message, FIELD.width / 2, 94, 17, PALETTE.text, 'center', 'middle');
    }
    // Mission intro banner (top-centre, big).
    if (state.missions.bannerTimer > 0 && state.missions.banner) {
      wrapBanner(state.missions.banner);
    }
    // Controls hint, bottom-right.
    textPlain('WASD move/drive  •  E enter car  •  F shoot  •  Shift run  •  P pause  •  N mute', FIELD.width - 16, FIELD.height - 16, 13, 'rgba(255,255,255,0.55)', 'right', 'middle');
    context.restore();
  }

  /** Seconds left on the current stage's escape timer, or null when it has none. */
  function currentStageTimer(missions) {
    const stage = currentStage(missions);
    if (!stage || !stage.seconds) return null;
    return Math.max(0, missions.timer);
  }

  function drawStar(cx, cy, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  function wrapBanner(message) {
    const words = message.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 62) {
        lines.push(line);
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    if (line) lines.push(line);
    const w = 780;
    const h = 40 + lines.length * 26;
    const y = 128;
    panel(FIELD.width / 2 - w / 2, y, w, h, PALETTE.panelEdge);
    for (let i = 0; i < lines.length; i += 1) {
      textPlain(lines[i], FIELD.width / 2, y + 34 + i * 26, 18, PALETTE.text, 'center', 'middle');
    }
  }

  function drawTitle(state, ui) {
    // A living backdrop: the city, mid-afternoon, with traffic rolling.
    context.save();
    drawCity(state);
    for (const car of state.traffic) drawCarShape(car, false);
    context.fillStyle = 'rgba(10, 14, 24, 0.45)';
    context.fillRect(state.camera.x - FIELD.width / 2, state.camera.y - FIELD.height / 2, FIELD.width, FIELD.height);
    context.restore();
    context.save();
    // Centre the title on the screen, not the world.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    text('SOLMAR CITY', FIELD.width / 2, 170, 84, '#ffd23f', 'center', 'middle');
    textPlain('an open-world crime story', FIELD.width / 2, 215, 24, PALETTE.text, 'center', 'middle');
    const lines = [
      'Vic needs a driver. Steal a car, run his jobs,',
      'lose the cops, and take the Marlin Casino.',
      'Five missions. One city. Your rules.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      textPlain(lines[i], FIELD.width / 2, 268 + i * 28, 19, PALETTE.muted, 'center', 'middle');
    }
    panel(FIELD.width / 2 - 330, 380, 660, 150, PALETTE.panelEdge);
    textPlain('WASD — move / drive      E — enter or steal a car', FIELD.width / 2, 412, 18, PALETTE.text, 'center', 'middle');
    textPlain('F or click — shoot      Shift — run      P — pause', FIELD.width / 2, 444, 18, PALETTE.text, 'center', 'middle');
    textPlain('M — start mission      N — mute', FIELD.width / 2, 476, 18, PALETTE.text, 'center', 'middle');
    const prompt = ui.saveExists ? 'ENTER — continue your save    SPACE — new game' : 'Press SPACE or click to start';
    text(prompt, FIELD.width / 2, 580, 26, '#7be07b', 'center', 'middle');
    if (ui.best > 0) textPlain('Best haul: $' + ui.best.toLocaleString('en-US'), FIELD.width / 2, 622, 16, PALETTE.muted, 'center', 'middle');
    context.restore();
  }

  function drawPaused() {
    context.save();
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = 'rgba(8, 12, 20, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 260, FIELD.height / 2 - 110, 520, 220, PALETTE.panelEdge);
    text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 40, 48, PALETTE.text, 'center', 'middle');
    textPlain('P or Space — resume      M — mission      N — mute', FIELD.width / 2, FIELD.height / 2 + 20, 18, PALETTE.muted, 'center', 'middle');
    textPlain('Your progress saves automatically.', FIELD.width / 2, FIELD.height / 2 + 52, 16, PALETTE.muted, 'center', 'middle');
    context.restore();
  }

  function drawOver(state, ui) {
    context.save();
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = 'rgba(8, 12, 20, 0.65)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 300, FIELD.height / 2 - 120, 600, 240, ui.overKind === 'busted' ? '#4f8ef7' : '#e5534b');
    const title = ui.overKind === 'busted' ? 'BUSTED!' : 'WASTED!';
    text(title, FIELD.width / 2, FIELD.height / 2 - 48, 56, ui.overKind === 'busted' ? '#7fb2ff' : '#ff7a6e', 'center', 'middle');
    textPlain(ui.overText || '', FIELD.width / 2, FIELD.height / 2 + 8, 19, PALETTE.text, 'center', 'middle');
    textPlain('Cash $' + Math.floor(state.player.money).toLocaleString('en-US') + '  •  Missions done: ' + state.stats.missionsDone, FIELD.width / 2, FIELD.height / 2 + 44, 17, PALETTE.muted, 'center', 'middle');
    text('Press SPACE to get back out there', FIELD.width / 2, FIELD.height / 2 + 86, 22, '#7be07b', 'center', 'middle');
    context.restore();
  }

  /** Paint one frame: the world through the camera, then the HUD or a menu. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale + (FIELD.width / 2) * view.scale, view.y - cam.y * view.scale + (FIELD.height / 2) * view.scale);
    drawCity(state);
    if (state.pickup) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.2;
      context.save();
      context.translate(state.pickup.x, state.pickup.y);
      context.scale(pulse, pulse);
      context.fillStyle = '#7be07b';
      context.beginPath();
      context.arc(0, 0, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1d5c1d';
      textPlain('$', 0, 0, 16, '#1d5c1d', 'center', 'middle');
      context.restore();
    }
    for (const car of state.traffic) drawCarShape(car, false);
    for (const car of state.police.cars) drawCarShape(car, false);
    // The player's own car: drawPlayer() returns early while the player is
    // driving, so the car shape has to be painted here or it never appears.
    if (state.player.car) drawCarShape(state.player.car, true);
    for (const ped of state.peds) if (!ped.dead) drawPed(ped);
    for (const enemy of state.combat.enemies) {
      if (enemy.dead) continue;
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(enemy.angle);
      context.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : '#8a2f2f';
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#111111';
      context.fillRect(11, -2, 14, 4);
      context.restore();
      // Health bar over the enemy.
      context.fillStyle = '#222222';
      context.fillRect(enemy.x - 16, enemy.y - 26, 32, 5);
      context.fillStyle = '#e5534b';
      context.fillRect(enemy.x - 16, enemy.y - 26, 32 * Math.max(0, enemy.health / 60), 5);
    }
    drawPlayer(state);
    // Bullets.
    context.fillStyle = PALETTE.bullet;
    for (const b of state.combat.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    drawMarker(state);
    // Back to screen space for the HUD and menus.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, ui);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
