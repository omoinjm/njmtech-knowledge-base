/**
 * Draw functions for different graph node types.
 */

// Cosmic Theme Colors
export const COSMIC_COLORS = {
  bgCenter: "#050a0e",
  bgEdge: "#000000",
  neonEmerald: "#00ff88",
  darkGreen: "#003320",
  categoryLabel: "#a7f3d0",
  textWhite: "rgba(255,255,255,0.75)",
  linkLine: "rgba(0,255,136,0.15)",
  highlight: "#00ff88",
} as const;

const TAG_ZOOM_THRESHOLD = 0.7;

/**
 * Draws a media item node.
 */
export function drawMediaNode(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  opacity: number,
  imgCache: Map<string, HTMLImageElement>
) {
  const { name, item } = node;
  const baseRadius = 22;

  let drawRadius = baseRadius;
  const isBrainMode = globalScale < 0.4;
  const isMidMode = globalScale >= 0.4 && globalScale < 0.7;

  if (isBrainMode) {
    drawRadius = 4;
  } else if (isMidMode) {
    drawRadius = baseRadius * 0.6;
  }

  const glowLevels = isBrainMode ? [{ r: drawRadius + 4, a: 0.15 }] : [
    { r: drawRadius + 20, a: 0.03 * opacity },
    { r: drawRadius + 12, a: 0.08 * opacity },
    { r: drawRadius + 6, a: 0.15 * opacity }
  ];

  glowLevels.forEach(glow => {
    ctx.beginPath();
    ctx.arc(0, 0, glow.r, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0, 255, 136, ${glow.a * opacity})`;
    ctx.fill();
  });

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, drawRadius);
  grad.addColorStop(0, `rgba(0, 255, 136, ${0.8 * opacity})`);
  grad.addColorStop(1, `rgba(0, 51, 32, ${opacity})`);
  
  ctx.beginPath();
  ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  if (isBrainMode || isMidMode) return;

  if (item?.thumbnailUrl) {
    const img = imgCache.get(item.thumbnailUrl);
    if (img && img.complete) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius - 4, 0, 2 * Math.PI);
      ctx.clip();
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, -(drawRadius - 4), -(drawRadius - 4), (drawRadius - 4) * 2, (drawRadius - 4) * 2);
      ctx.fillStyle = `rgba(0, 255, 136, ${0.15 * opacity})`;
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.filter = "blur(2px)";
  ctx.beginPath();
  ctx.ellipse(-drawRadius/3, -drawRadius/3, drawRadius/3, drawRadius/5, Math.PI/4, 0, 2 * Math.PI);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * opacity})`;
  ctx.fill();
  ctx.restore();

  if (globalScale > 0.6) {
    const label = name.length > 20 ? name.substring(0, 20) + "..." : name;
    ctx.font = `${10 / globalScale}px 'Inter', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = COSMIC_COLORS.textWhite;
    ctx.globalAlpha = opacity;
    ctx.fillText(label, 0, drawRadius + 14);
  }
}

/**
 * Draws a topic tag node.
 */
export function drawTagNode(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  opacity: number,
  tagsEnabled: boolean
) {
  const { name } = node;
  let drawRadius = 14;
  
  const isBrainMode = globalScale < 0.4;

  if (isBrainMode) {
    drawRadius = 3;
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
    ctx.fillStyle = COSMIC_COLORS.neonEmerald;
    ctx.globalAlpha = 0.8 * opacity * (tagsEnabled ? 1 : 0);
    if (ctx.globalAlpha > 0) ctx.fill();
    return;
  }

  const fadeProgress = tagsEnabled ? Math.min(1, (globalScale - TAG_ZOOM_THRESHOLD) / 0.2) : 0;
  if (fadeProgress <= 0) return;

  ctx.font = "11px 'Inter', sans-serif";
  const width = ctx.measureText(name).width + 20;
  const height = 22;

  ctx.save();
  ctx.globalAlpha = fadeProgress * opacity;
  ctx.shadowColor = COSMIC_COLORS.neonEmerald;
  ctx.shadowBlur = 12 * opacity;
  ctx.beginPath();
  ctx.roundRect(-width/2, -height/2, width, height, height/2);
  ctx.fillStyle = `rgba(0, 255, 136, ${0.08 * opacity})`;
  ctx.strokeStyle = COSMIC_COLORS.neonEmerald;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  if (globalScale > 0.9) {
    ctx.save();
    ctx.globalAlpha = fadeProgress * opacity;
    ctx.fillStyle = COSMIC_COLORS.neonEmerald;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 0, 0);
    ctx.restore();
  }
}

/**
 * Draws a category hub node.
 */
export function drawCategoryNode(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  opacity: number
) {
  const { name } = node;
  const baseRadius = 28;
  let drawRadius = baseRadius;

  const isBrainMode = globalScale < 0.4;
  const isMidMode = globalScale >= 0.4 && globalScale < 0.7;

  if (isBrainMode) {
    drawRadius = 5;
    ctx.beginPath();
    ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
    ctx.fillStyle = COSMIC_COLORS.neonEmerald;
    ctx.shadowColor = COSMIC_COLORS.neonEmerald;
    ctx.shadowBlur = 10;
    ctx.fill();
    return;
  }

  if (isMidMode) drawRadius = baseRadius * 0.6;

  ctx.save();
  ctx.shadowColor = COSMIC_COLORS.neonEmerald;
  ctx.shadowBlur = 20 * opacity;
  ctx.beginPath();
  ctx.arc(0, 0, drawRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = COSMIC_COLORS.neonEmerald;
  ctx.lineWidth = 3;
  ctx.globalAlpha = opacity;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, drawRadius - 10, 0, 2 * Math.PI);
  ctx.fillStyle = `rgba(0, 255, 136, ${0.2 * opacity})`;
  ctx.fill();

  ctx.save();
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.arc(0, 0, drawRadius + 8, 0, 2 * Math.PI);
  ctx.strokeStyle = `rgba(0, 255, 136, ${0.3 * opacity})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (globalScale > 0.6) {
    ctx.font = `bold ${12 / globalScale}px 'Inter', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = COSMIC_COLORS.categoryLabel;
    ctx.globalAlpha = opacity;
    ctx.fillText(name, 0, drawRadius + 20);
  }
}
