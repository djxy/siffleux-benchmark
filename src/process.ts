import { spawn, type ChildProcess } from "child_process";

export function sleep(seconds: number) {
  return new Promise((res, _) => {
    setTimeout(res, seconds * 1000);
  });
}

export class Process {
  #spawned_process: ChildProcess;

  #is_closed = false;

  static spawn(cmd: string, ...args: string[]) {
    return new Process(cmd, args);
  }

  private constructor(cmd: string, args: string[]) {
    this.#spawned_process = spawn(cmd, args, { stdio: "inherit" });

    this.#spawned_process.on("close", (_) => {
      this.#is_closed = true;
    });
  }

  kill() {
    this.#spawned_process.kill();
  }

  closed() {
    return new Promise((res, rej) => {
      this.#spawned_process.on("close", (_) => {
        res(null);
      });
    });
  }

  get is_closed() {
    return this.#is_closed;
  }
}
