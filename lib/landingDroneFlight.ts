// Allocation-free animation state. No timers, React updates, assets or physics engine.
export type FlightPoint = { x: number; y: number; z: number };
type CollisionSphere = FlightPoint & { radius: number };
export type RobotObstacle = {
  active: boolean;
  body: CollisionSphere;
  head: CollisionSphere;
  cooldown: number;
  impact: number;
  impactAge: number;
  impactNormal: FlightPoint;
};
export type DroneConfig = { id: number; scale: number; speed: number };
export const DRONE_CONFIGS: readonly DroneConfig[] = [
  { id: 1, scale: 1.8 * 2, speed: 1.45 },
  { id: 2, scale: 1.65 * 2, speed: 1.2 },
  { id: 3, scale: 1.75 * 2, speed: 1.6 },
  { id: 4, scale: 1.6 * 2, speed: 1.3 },
  { id: 5, scale: 1.8 * 2, speed: 1.35 },
  { id: 6, scale: 1.7 * 2, speed: 1.5 },
];
const point = (): FlightPoint => ({ x: 0, y: 0, z: 0 });

export function createRobotObstacle(): RobotObstacle {
  return { active: false, body: { ...point(), radius: 0 }, head: { ...point(), radius: 0 }, cooldown: 0, impact: 0, impactAge: 0, impactNormal: point() };
}

export function advanceRobotImpact(robot: RobotObstacle, delta: number) {
  robot.cooldown = Math.max(0, robot.cooldown - delta);
  robot.impactAge += delta;
  robot.impact *= Math.exp(-5 * delta);
}

export type DroneFlight = ReturnType<typeof createDroneFlight>;
export function createDroneFlight(config: DroneConfig) {
  return {
    config, seed: (config.id * 2654435761) >>> 0, generation: 0,
    elapsed: 0, age: 0, targetAge: 0, retargetAfter: 0,
    delay: config.id * .25, respawnIn: 0, visible: false, hit: false,
    position: { x: (config.id - 3.5) * 1.8, y: -11, z: -6.2 },
    spawn: { x: (config.id - 3.5) * 1.8, y: -11, z: -6.2 },
    velocity: point(), target: point(), rotation: point(),
    bounds: { left: -6, right: 6, bottom: -3.5, top: 3.5, entryY: -11 },
    contact: { normal: point(), position: point() },
    wreck: { active: false, age: 0, opacity: 0, position: point(), velocity: point(), rotation: point(), spin: point() },
    burst: { active: false, age: 0, opacity: 0, scale: 0, position: point(), normal: point() },
  };
}

// Called on viewport changes, never per frame. Leave space for the drone's hull.
export function updateDroneViewport(flight: DroneFlight, halfWidth: number, halfHeight: number) {
  const margin = flight.config.scale * .23;
  const width = Math.max(.2, halfWidth - margin);
  const height = Math.max(.2, halfHeight - margin);
  Object.assign(flight.bounds, { left: -width, right: width, bottom: -height, top: height, entryY: -halfHeight - 4 });
  if (flight.age === 0 && flight.generation === 0) {
    flight.spawn.x = ((flight.config.id - .5) / DRONE_CONFIGS.length * 2 - 1) * width;
    flight.spawn.y = flight.bounds.entryY;
    Object.assign(flight.position, flight.spawn);
  }
  if (flight.age < 3.2) {
    flight.target.x = Math.max(-width, Math.min(width, flight.target.x));
    flight.target.y = Math.max(-height, Math.min(height, flight.target.y));
  } else flight.targetAge = flight.retargetAfter + 1;
}

function random(flight: DroneFlight) {
  let seed = flight.seed;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  flight.seed = seed >>> 0;
  return flight.seed / 4294967296;
}

function chooseTarget(flight: DroneFlight) {
  const bounds = flight.bounds;
  flight.target.x = bounds.left + random(flight) * (bounds.right - bounds.left);
  flight.target.y = bounds.bottom + random(flight) * (bounds.top - bounds.bottom);
  flight.target.z = -1.8 + random(flight) * 3.4;
  flight.targetAge = 0;
  flight.retargetAfter = 2.5 + random(flight) * 3.5;
}

function respawn(flight: DroneFlight) {
  flight.generation++;
  flight.age = 0;
  flight.spawn.x = flight.bounds.left + random(flight) * (flight.bounds.right - flight.bounds.left);
  flight.spawn.y = flight.bounds.entryY;
  flight.spawn.z = -6.2;
  Object.assign(flight.position, flight.spawn);
  flight.velocity.x = flight.velocity.y = flight.velocity.z = 0;
  chooseTarget(flight);
  flight.visible = true;
}

// Earliest swept contact, including a moving robot overlapping a stationary drone.
function contactTime(x: number, y: number, z: number, end: FlightPoint, sphere: CollisionSphere, padding: number) {
  const dx = end.x - x, dy = end.y - y, dz = end.z - z;
  const px = x - sphere.x, py = y - sphere.y, pz = z - sphere.z;
  const c = px * px + py * py + pz * pz - (sphere.radius + padding) ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = px * dx + py * dy + pz * dz;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= 0 && time <= 1 ? time : Infinity;
}

export function stepDroneFlight(flight: DroneFlight, robot: RobotObstacle, delta: number) {
  const dt = Math.max(0, Math.min(delta, .05));
  flight.hit = false;
  if (!dt) return;
  flight.elapsed += dt;

  const wreck = flight.wreck;
  if (wreck.active) {
    wreck.age += dt;
    wreck.velocity.y -= 7.8 * dt;
    wreck.position.x += wreck.velocity.x * dt;
    wreck.position.y += wreck.velocity.y * dt;
    wreck.position.z += wreck.velocity.z * dt;
    const drag = Math.exp(-.7 * dt);
    wreck.velocity.x *= drag; wreck.velocity.z *= drag;
    wreck.rotation.x += wreck.spin.x * dt;
    wreck.rotation.y += wreck.spin.y * dt;
    wreck.rotation.z += wreck.spin.z * dt;
    wreck.spin.x *= drag; wreck.spin.y *= drag; wreck.spin.z *= drag;
    wreck.opacity = Math.max(0, 1 - Math.max(0, wreck.age - .35) / 1.65);
    wreck.active = wreck.age < 2;
  }
  const burst = flight.burst;
  if (burst.active) {
    burst.age += dt;
    burst.opacity = Math.max(0, 1 - burst.age / .4) ** 2;
    burst.scale = (.55 + burst.age * 3.4) * Math.max(1, flight.config.scale * .25);
    burst.active = burst.age < .4;
  }

  if (flight.delay > 0) {
    flight.delay -= dt;
    if (flight.delay <= 0) { chooseTarget(flight); flight.visible = true; }
    return;
  }
  if (flight.respawnIn > 0) {
    flight.respawnIn -= dt;
    if (flight.respawnIn <= 0) respawn(flight);
    return;
  }

  flight.age += dt;
  // Match the robot's 3.2s emergence. Each drone starts below the camera and at depth.
  if (flight.age < 3.2) {
    const progress = flight.age / 3.2;
    const ease = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    flight.position.x = flight.spawn.x + (flight.target.x - flight.spawn.x) * ease;
    flight.position.y = flight.spawn.y + (flight.target.y - flight.spawn.y) * ease;
    flight.position.z = flight.spawn.z + (flight.target.z - flight.spawn.z) * ease;
    return;
  }
  flight.targetAge += dt;
  const position = flight.position, velocity = flight.velocity;
  let dx = flight.target.x - position.x, dy = flight.target.y - position.y, dz = flight.target.z - position.z;
  if (dx * dx + dy * dy + dz * dz < .36 || flight.targetAge > flight.retargetAfter) {
    chooseTarget(flight);
    dx = flight.target.x - position.x; dy = flight.target.y - position.y; dz = flight.target.z - position.z;
  }
  const length = Math.max(.001, Math.hypot(dx, dy, dz));
  const steering = 1 - Math.exp(-2.2 * dt);
  const speed = flight.config.speed / length;
  velocity.x += (dx * speed - velocity.x) * steering;
  velocity.y += (dy * speed - velocity.y) * steering;
  velocity.z += (dz * speed - velocity.z) * steering;
  const previousX = position.x, previousY = position.y, previousZ = position.z;
  position.x += velocity.x * dt; position.y += velocity.y * dt; position.z += velocity.z * dt;
  const heading = Math.atan2(velocity.x, velocity.z);
  const yaw = flight.rotation.y;
  flight.rotation.y += Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw)) * (1 - Math.exp(-4 * dt));
  flight.rotation.x += (-velocity.y * .16 - flight.rotation.x) * steering;
  flight.rotation.z += (-velocity.x * .08 - flight.rotation.z) * steering;

  // The whole drone hull touches the outer armor, never the logo or robot center.
  // Separation runs even during effect cooldown, so other drones cannot ghost through.
  if (!robot.active) return;
  const padding = flight.config.scale * .22 + .08;
  const bodyTime = contactTime(previousX, previousY, previousZ, position, robot.body, padding);
  const headTime = contactTime(previousX, previousY, previousZ, position, robot.head, padding);
  const time = Math.min(bodyTime, headTime);
  if (!Number.isFinite(time)) return;
  const shell = bodyTime <= headTime ? robot.body : robot.head;
  const normal = flight.contact.normal;
  normal.x = previousX + (position.x - previousX) * time - shell.x;
  normal.y = previousY + (position.y - previousY) * time - shell.y;
  normal.z = previousZ + (position.z - previousZ) * time - shell.z;
  const normalLength = Math.hypot(normal.x, normal.y, normal.z);
  if (normalLength < .001) { normal.x = configSide(flight); normal.y = 0; normal.z = 0; }
  else { normal.x /= normalLength; normal.y /= normalLength; normal.z /= normalLength; }
  const clearance = shell.radius + padding + .04;
  position.x = shell.x + normal.x * clearance;
  position.y = shell.y + normal.y * clearance;
  position.z = shell.z + normal.z * clearance;
  const contact = flight.contact.position;
  contact.x = shell.x + normal.x * (shell.radius + .03);
  contact.y = shell.y + normal.y * (shell.radius + .03);
  contact.z = shell.z + normal.z * (shell.radius + .03);
  const incoming = Math.min(0, velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z);
  velocity.x += normal.x * (-1.45 * incoming + 1.8);
  velocity.y += normal.y * (-1.45 * incoming + 1.8);
  velocity.z += normal.z * (-1.45 * incoming + 1.8);
  flight.targetAge = flight.retargetAfter + 1;
  if (robot.cooldown === 0 && !wreck.active) {
    flight.hit = true;
    flight.visible = false;
    flight.respawnIn = .65;
    wreck.active = true; wreck.age = 0; wreck.opacity = 1;
    Object.assign(wreck.position, position); Object.assign(wreck.rotation, flight.rotation);
    wreck.velocity.x = velocity.x; wreck.velocity.y = velocity.y + .7; wreck.velocity.z = velocity.z;
    wreck.spin.x = normal.z * 6 + 2; wreck.spin.y = configSide(flight) * 3; wreck.spin.z = -normal.x * 6;
    burst.active = true; burst.age = 0; burst.opacity = 1; burst.scale = .55;
    Object.assign(burst.position, contact); Object.assign(burst.normal, normal);
    Object.assign(robot.impactNormal, normal);
    robot.cooldown = .85; robot.impact = 1; robot.impactAge = 0;
  }
}

function configSide(flight: DroneFlight) { return flight.config.id % 2 ? 1 : -1; }
