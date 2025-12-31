export function resizeCanvas(canvas, targetWidth, targetHeight) {
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const scale = Math.min(window.innerWidth / targetWidth, window.innerHeight / targetHeight);
  canvas.style.width = `${targetWidth * scale}px`;
  canvas.style.height = `${targetHeight * scale}px`;
}

export function renderGame(ctx, state) {
  const { grid, tileSize, player, start, exit, hud, debug, victory } = state;
  const height = grid.length;
  const width = grid[0].length;
  const mapWidth = width * tileSize;
  const mapHeight = height * tileSize;
  const offsetX = (ctx.canvas.width - mapWidth) / 2;
  const offsetY = (ctx.canvas.height - mapHeight) / 2;

  ctx.fillStyle = "#11151c";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ctx.fillStyle = grid[y][x] === 1 ? "#1f2937" : "#e2e8f0";
      ctx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
    }
  }

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(
    offsetX + start[0] * tileSize + tileSize * 0.25,
    offsetY + start[1] * tileSize + tileSize * 0.25,
    tileSize * 0.5,
    tileSize * 0.5
  );
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(
    offsetX + exit[0] * tileSize + tileSize * 0.25,
    offsetY + exit[1] * tileSize + tileSize * 0.25,
    tileSize * 0.5,
    tileSize * 0.5
  );

  ctx.fillStyle = "#facc15";
  ctx.fillRect(
    offsetX + player.x - player.size / 2,
    offsetY + player.y - player.size / 2,
    player.size,
    player.size
  );

  ctx.fillStyle = "#f8fafc";
  ctx.font = "16px monospace";
  ctx.fillText(hud.title, 16, 24);
  ctx.fillText(hud.subtitle, 16, 44);
  ctx.fillText(hud.controls, 16, 64);

  if (debug.enabled) {
    let y = 90;
    for (const line of debug.lines) {
      ctx.fillText(line, 16, y);
      y += 18;
    }
  }

  if (victory) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#facc15";
    ctx.font = "28px sans-serif";
    ctx.fillText("Победа!", ctx.canvas.width / 2 - 60, ctx.canvas.height / 2 - 20);
    ctx.font = "18px monospace";
    ctx.fillText(`Время: ${victory.time.toFixed(2)} сек`, ctx.canvas.width / 2 - 100, ctx.canvas.height / 2 + 10);
    ctx.fillText("R — новый лабиринт, Enter — повтор", ctx.canvas.width / 2 - 170, ctx.canvas.height / 2 + 40);
  }
}

export function renderMenu(ctx, title, lines) {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "28px sans-serif";
  ctx.fillText(title, 40, 80);
  ctx.font = "18px monospace";
  let y = 130;
  for (const line of lines) {
    ctx.fillText(line, 40, y);
    y += 24;
  }
}
