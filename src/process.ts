import { spawn, type ChildProcess } from "child_process";
import fs from "fs";

export interface ProcessOptions {
  cmd: string;
  args: string[];
  stdout_file?: string;
  stderr_file?: string;
}

export function sleep(seconds: number) {
  return new Promise((res, _) => {
    setTimeout(res, seconds * 1000);
  });
}

export class Process {
  #spawned_process: ChildProcess;

  #is_closed = false;

  static spawn(opt: ProcessOptions) {
    return new Process(opt);
  }

  private constructor(opt: ProcessOptions) {
    const stdout = opt.stdout_file ? fs.openSync(opt.stdout_file, "a") : 'inherit';
    const stderr = opt.stderr_file ? fs.openSync(opt.stderr_file, "a") : 'inherit';

    this.#spawned_process = spawn(opt.cmd, opt.args, {
      stdio: ["ignore", stdout, stderr],
    });

    this.#spawned_process.on("close", (_) => {
      if (typeof stderr === 'number') {
        fs.closeSync(stderr);
      }
      if (typeof stdout === 'number') {
        fs.closeSync(stdout);
      }

      this.#is_closed = true;
    });
  }

  pid() {
    return this.#spawned_process.pid as number;
  }

  kill() {
    this.#spawned_process.kill();
  }

  closed() {
    if (this.#is_closed) {
      return Promise.resolve();
    }

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
