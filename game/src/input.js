// Keyboard and mouse state, plus an override hook the screenshot autopilot
// uses to drive the game without a real player.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false, // set for one frame when the mouse button goes down
    clickX: 0,
    clickY: 0,
    override: null, // {up,down,left,right,handbrake,shoot} or null
    pressed: new Set(), // keys pressed this frame (edge-triggered)
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.toLowerCase();
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.clickX = (e.clientX - r.left) * (canvas.width / r.width);
    input.clickY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

export function keyDown(input, key) {
  return input.keys.has(key);
}

export function keyPressed(input, key) {
  return input.pressed.has(key);
}

// Movement axes: override (autopilot) wins over the real keyboard.
export function moveAxes(input) {
  const o = input.override;
  const up = o ? !!o.up : input.keys.has('w') || input.keys.has('arrowup');
  const down = o ? !!o.down : input.keys.has('s') || input.keys.has('arrowdown');
  const left = o ? !!o.left : input.keys.has('a') || input.keys.has('arrowleft');
  const right = o ? !!o.right : input.keys.has('d') || input.keys.has('arrowright');
  const handbrake = o ? !!o.handbrake : input.keys.has(' ');
  const run = input.keys.has('shift');
  return { up, down, left, right, handbrake, run };
}

export function endFrame(input) {
  input.pressed.clear();
  input.clicked = false;
}
