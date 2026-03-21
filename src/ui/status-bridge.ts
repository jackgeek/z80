// Status bridge — global status callback that media modules can import

let statusFn: (msg: string) => void = console.log;

export function setGlobalStatusFn(fn: (msg: string) => void): void {
  statusFn = fn;
}

export function showStatus(msg: string): void {
  statusFn(msg);
}
