/**
 * Decoding happens in JavaScript (jsQR) rather than through the browser's
 * BarcodeDetector: that API is missing from Safari and, on Windows, from Chrome
 * too, so half the machines a seller might stand behind could not scan at all.
 * All this needs now is a camera.
 */
export function isCameraScanSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Why the camera cannot be used. Browsers hide it entirely on plain http
 * other than localhost, which is exactly what a phone opening the dev server
 * by LAN address gets - and that is not a missing camera.
 */
export function cameraUnavailableMessage(): string {
  return window.isSecureContext === false
    ? 'Trình duyệt chỉ cho mở camera trên trang HTTPS hoặc localhost. Trang này đang mở qua http nên không quét được.'
    : 'Thiết bị này không có camera dùng được.';
}

/** Longest edge fed to the decoder: smaller frames decode faster and still read. */
export const SCAN_FRAME_SIZE = 480;

/** How often a frame is decoded. Every frame is wasted work for a still code. */
export const SCAN_INTERVAL_MS = 120;

/**
 * How long a code must be out of frame before the same code counts as a new
 * scan. Long enough that a few blurred frames of a code still held up do not
 * resubmit it; short enough that "take it away and show it again" works.
 */
export const SCAN_REARM_MS = 1000;
