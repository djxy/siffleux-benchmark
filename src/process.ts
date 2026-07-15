import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

export interface ProcessOptions {
  cmd: string;
  args: string[];
  name?: string;
  logs_folder?: string;
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
    const name = opt.name ?? opt.cmd;
    this.#spawned_process = spawn(opt.cmd, opt.args, {
      stdio: [
        "ignore",
        opt.logs_folder
          ? fs.openSync(path.join(opt.logs_folder, `${name}.log`), "a")
          : "inherit",
        "inherit",
      ],
    });

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
