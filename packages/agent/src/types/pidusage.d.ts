declare module "pidusage" {
  interface Stat {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
  }

  interface Options {
    usePs?: boolean;
    maxage?: number;
  }

  function pidusage(pids: number | number[], options?: Options): Promise<Record<number, Stat>>;
  function pidusage(pids: number | number[], callback: (err: Error | null, stats: Record<number, Stat>) => void): void;
  function pidusage(pids: number | number[], options: Options, callback: (err: Error | null, stats: Record<number, Stat>) => void): void;

  namespace pidusage {
    function clear(): void;
  }

  export default pidusage;
}
