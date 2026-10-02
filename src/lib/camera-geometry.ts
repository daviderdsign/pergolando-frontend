/**
 * Client-side camera projection math, mirroring pergolando-geocalib-
 * service's resection.py exactly (same rotation convention, same world/
 * camera axes — see that file for the derivation). Runs in the browser so
 * the grid overlay and rectangle drag (GrigliaPosizionamento) update live
 * while the seller drags, with no round trip to the backend per frame.
 *
 * World convention: X = width (right+), Y = height (down+, so above the
 * floor is negative Y), Z = depth (front=0, rear=P — the wall, for the
 * wizard's wall/ceiling-only mounting). Camera convention: X right, Y down,
 * Z forward (OpenCV/GeoCalib).
 */

export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export interface PosaCamera {
  rvec: number[];
  tvec: number[];
  fovDeg: number;
  fotoLarghezzaPx: number;
  fotoAltezzaPx: number;
}

/** Axis-angle (OpenCV `rvec` convention) to a 3x3 rotation matrix — the
 * standard Rodrigues formula. */
export function rotFromRvec([rx, ry, rz]: number[]): Mat3 {
  const theta = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (theta < 1e-12) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
  const [kx, ky, kz] = [rx / theta, ry / theta, rz / theta];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const t = 1 - c;
  return [
    [t * kx * kx + c, t * kx * ky - s * kz, t * kx * kz + s * ky],
    [t * kx * ky + s * kz, t * ky * ky + c, t * ky * kz - s * kx],
    [t * kx * kz - s * ky, t * ky * kz + s * kx, t * kz * kz + c],
  ];
}

export function matVec(R: Mat3, v: Vec3): Vec3 {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
  ];
}

/** Transpose-times-vector — used to go from camera-space back to
 * world-space directions (R is world-to-camera, so R^T is its inverse: a
 * rotation matrix is always orthonormal). */
export function matTVec(R: Mat3, v: Vec3): Vec3 {
  return [
    R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2],
    R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2],
    R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2],
  ];
}

export interface CameraModel {
  R: Mat3;
  t: Vec3;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export function cameraModelFromPosa(posa: PosaCamera): CameraModel {
  const R = rotFromRvec(posa.rvec);
  const t: Vec3 = [posa.tvec[0]!, posa.tvec[1]!, posa.tvec[2]!];
  const fovRad = (posa.fovDeg * Math.PI) / 180;
  const fx = posa.fotoLarghezzaPx / (2 * Math.tan(fovRad / 2));
  return { R, t, fx, fy: fx, cx: posa.fotoLarghezzaPx / 2, cy: posa.fotoAltezzaPx / 2 };
}

/** World point -> pixel coordinates (forward projection). */
export function worldToPixel(P: Vec3, cam: CameraModel): [number, number] {
  const p = matVec(cam.R, P);
  const pc: Vec3 = [p[0] + cam.t[0], p[1] + cam.t[1], p[2] + cam.t[2]];
  return [(cam.fx * pc[0]) / pc[2] + cam.cx, (cam.fy * pc[1]) / pc[2] + cam.cy];
}

/** Like `worldToPixel`, but returns null instead of a wild coordinate for a
 * point at or behind the camera (camera-space Z below `minDepthCm`) — a
 * plain image-bounds check isn't enough, because a point that's merely
 * NEAR the camera still divides by a near-zero Z and produces a technically
 * finite but meaningless pixel far outside the frame (real bug, seen live:
 * a grid extended far enough toward the camera fanned out into the sky).
 * Always use this, not the raw one, for anything spanning a real-world
 * range rather than a single known-in-frame point. */
export function worldToPixelSafe(
  P: Vec3,
  cam: CameraModel,
  minDepthCm = 30,
): [number, number] | null {
  const p = matVec(cam.R, P);
  const pz = p[2] + cam.t[2];
  if (pz < minDepthCm) return null;
  const pc: Vec3 = [p[0] + cam.t[0], p[1] + cam.t[1], pz];
  return [(cam.fx * pc[0]) / pc[2] + cam.cx, (cam.fy * pc[1]) / pc[2] + cam.cy];
}

/** Camera's own position, in world coordinates. */
function cameraPositionWorld(cam: CameraModel): Vec3 {
  const negT: Vec3 = [-cam.t[0], -cam.t[1], -cam.t[2]];
  return matTVec(cam.R, negT);
}

/** Pixel -> world-space ray direction (unnormalized, camera-space [dx,dy,1]
 * rotated into world space). */
function pixelRayWorld(px: number, py: number, cam: CameraModel): Vec3 {
  const dCam: Vec3 = [(px - cam.cx) / cam.fx, (py - cam.cy) / cam.fy, 1];
  return matTVec(cam.R, dCam);
}

/** Intersects the pixel's camera ray with the world floor plane (Y=0).
 * Returns null if the ray is (near-)parallel to the floor, or points away
 * from it (both mean "this pixel isn't showing the floor"). */
export function pixelToFloor(px: number, py: number, cam: CameraModel): { x: number; z: number } | null {
  const origin = cameraPositionWorld(cam);
  const dir = pixelRayWorld(px, py, cam);
  if (Math.abs(dir[1]) < 1e-9) return null;
  const s = -origin[1] / dir[1];
  if (s <= 0) return null;
  return { x: origin[0] + s * dir[0], z: origin[2] + s * dir[2] };
}

/** Intersects the pixel's camera ray with the world wall plane (Z=zWall). */
export function pixelToWall(
  px: number,
  py: number,
  zWall: number,
  cam: CameraModel,
): { x: number; y: number } | null {
  const origin = cameraPositionWorld(cam);
  const dir = pixelRayWorld(px, py, cam);
  if (Math.abs(dir[2]) < 1e-9) return null;
  const s = (zWall - origin[2]) / dir[2];
  if (s <= 0) return null;
  return { x: origin[0] + s * dir[0], y: origin[1] + s * dir[1] };
}

/** Re-expresses a camera pose relative to a new world origin (`newOrigin`,
 * in the OLD frame) — same rotation, translation shifted so that point
 * becomes (0,0,0). Used once the seller has drawn the pergola's actual
 * front-left corner on the grid: everything downstream (Blender) expects
 * the camera pose relative to the PERGOLA's own frame, not the arbitrary
 * calibration line's. */
export function rebasePose(posa: PosaCamera, newOrigin: Vec3): PosaCamera {
  const cam = cameraModelFromPosa(posa);
  const shifted = matVec(cam.R, newOrigin);
  return {
    ...posa,
    tvec: [cam.t[0] + shifted[0], cam.t[1] + shifted[1], cam.t[2] + shifted[2]],
  };
}
