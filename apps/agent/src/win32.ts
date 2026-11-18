/**
 * Thin bindings to Windows APIs via koffi (no native compiling needed).
 * Only reads: which window is in front, which program owns it, and idle time.
 */
import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

const LASTINPUTINFO = koffi.struct("LASTINPUTINFO", { cbSize: "uint32", dwTime: "uint32" });

const GetForegroundWindow = user32.func("void* GetForegroundWindow()");
const GetWindowThreadProcessId = user32.func("uint32 GetWindowThreadProcessId(void* hwnd, _Out_ uint32* pid)");
const GetWindowTextW = user32.func("int GetWindowTextW(void* hwnd, _Out_ uint16* buf, int max)");
const GetLastInputInfo = user32.func("bool GetLastInputInfo(_Inout_ LASTINPUTINFO* info)");
const GetTickCount = kernel32.func("uint32 GetTickCount()");
const OpenProcess = kernel32.func("void* OpenProcess(uint32 access, bool inherit, uint32 pid)");
const QueryFullProcessImageNameW = kernel32.func(
  "bool QueryFullProcessImageNameW(void* h, uint32 flags, _Out_ uint16* buf, _Inout_ uint32* size)",
);
const CloseHandle = kernel32.func("bool CloseHandle(void* h)");

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

export interface Foreground {
  pid: number;
  exePath: string | null; // null when Windows refuses (e.g. elevated/admin windows)
  title: string;
}

const pathCache = new Map<number, string | null>();

function exePathOf(pid: number): string | null {
  if (pathCache.has(pid)) return pathCache.get(pid)!;
  const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  let path: string | null = null;
  if (h) {
    const buf = new Uint16Array(1024);
    const size = [buf.length];
    if (QueryFullProcessImageNameW(h, 0, buf, size)) {
      path = String.fromCharCode(...buf.subarray(0, size[0]));
    }
    CloseHandle(h);
  }
  if (pathCache.size > 500) pathCache.clear();
  pathCache.set(pid, path);
  return path;
}

export function getForeground(): Foreground | null {
  const hwnd = GetForegroundWindow();
  if (!hwnd) return null;
  const pidOut = [0];
  GetWindowThreadProcessId(hwnd, pidOut);
  const pid = pidOut[0];
  if (!pid) return null;
  const tbuf = new Uint16Array(512);
  const n = GetWindowTextW(hwnd, tbuf, tbuf.length);
  const title = n > 0 ? String.fromCharCode(...tbuf.subarray(0, n)) : "";
  return { pid, exePath: exePathOf(pid), title };
}

/** Seconds since the last keyboard or mouse input (system-wide). */
export function getIdleSeconds(): number {
  const info = { cbSize: 8, dwTime: 0 };
  if (!GetLastInputInfo(info)) return 0;
  const now = GetTickCount();
  return ((now - info.dwTime) >>> 0) / 1000;
}
