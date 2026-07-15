import chalk from 'chalk';
import Table from 'cli-table3';

const DAEMON_URL = 'http://localhost:7777';

export async function cliPorts() {
  try {
    const response = await fetch(`${DAEMON_URL}/api/ports`);
    const data = await response.json() as any;
    const ports = data.ports || [];

    if (ports.length === 0) {
      console.log(chalk.yellow('No active ports found.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.bold.cyan('PORT'),
        chalk.bold.cyan('PROCESS'),
        chalk.bold.cyan('PID'),
        chalk.bold.cyan('MEMORY'),
        chalk.bold.cyan('HEALTH')
      ],
      style: {
        head: [],
        border: ['cyan']
      },
      colWidths: [10, 28, 10, 12, 12]
    });

    for (const p of ports) {
      const health = p.health === 'healthy'
        ? chalk.green('\u2713 healthy')
        : chalk.red('\u2717 unhealthy');

      table.push([
        chalk.bold.yellow(String(p.port)),
        p.name || 'unknown',
        String(p.pid),
        p.memory !== null ? `${p.memory} MB` : '\u2014',
        health
      ]);
    }

    console.log('\n' + table.toString());
    console.log(chalk.gray(`\nTotal: ${ports.length} active port${ports.length !== 1 ? 's' : ''}\n`));
  } catch {
    console.error(chalk.red('\u2717 Error fetching ports. Is daemon running? Run "perch start"'));
  }
}

export async function cliKill(portOrPid: string) {
  try {
    const identifier = parseInt(portOrPid, 10);
    if (isNaN(identifier)) {
      console.error(chalk.red(`\u2717 Invalid port or PID: "${portOrPid}"`));
      return;
    }

    const response = await fetch(`${DAEMON_URL}/api/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portOrPid: identifier }),
    });

    const result = await response.json() as any;

    if (response.ok && result.success) {
      console.log(chalk.green(`\u2713 ${result.message}`));
      if (result.killedAt) {
        console.log(chalk.gray(`  Killed at: ${result.killedAt}`));
      }
    } else {
      console.error(chalk.red(`\u2717 ${result.message || 'Failed to kill process'}`));
    }
  } catch (err: any) {
    // Daemon killing itself kills the connection before response arrives
    if (err?.cause?.code === 'ECONNREFUSED' || err?.cause?.code === 'ECONNRESET') {
      console.log(chalk.green('\u2713 Daemon stopped. Port 7777 is now free.'));
    } else {
      console.error(chalk.red('\u2717 Failed to kill process. Is daemon running?'));
    }
  }
}

export async function cliRestart(portOrPid: string) {
  try {
    const identifier = parseInt(portOrPid, 10);
    if (isNaN(identifier)) {
      console.error(chalk.red(`\u2717 Invalid port or PID: "${portOrPid}"`));
      return;
    }

    console.log(chalk.gray('Restarting process...'));

    const response = await fetch(`${DAEMON_URL}/api/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portOrPid: identifier }),
    });

    const result = await response.json() as any;

    if (response.ok && result.success) {
      console.log(chalk.green(`\u2713 ${result.message}`));
      if (result.killedAt) console.log(chalk.gray(`  Killed at: ${result.killedAt}`));
      if (result.startedAt) console.log(chalk.gray(`  Started at: ${result.startedAt}`));
    } else {
      console.error(chalk.red(`\u2717 ${result.message || 'Failed to restart process'}`));
    }
  } catch {
    console.error(chalk.red('\u2717 Failed to restart process. Is daemon running?'));
  }
}

export async function cliHealth() {
  try {
    const response = await fetch(`${DAEMON_URL}/api/health`);
    const data = await response.json() as any;
    const services = data.health || [];

    if (services.length === 0) {
      console.log(chalk.yellow('No services with ports found.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.bold.cyan('SERVICE'),
        chalk.bold.cyan('STATUS'),
        chalk.bold.cyan('PORT'),
        chalk.bold.cyan('LAST CHECK')
      ],
      style: {
        head: [],
        border: ['cyan']
      },
      colWidths: [26, 10, 10, 22]
    });

    for (const s of services) {
      const status = s.status === 'healthy'
        ? chalk.green('\u2713')
        : chalk.red('\u2717');

      table.push([
        s.name || s.processName || `PID ${s.pid}`,
        status,
        s.port ? String(s.port) : '\u2014',
        s.checkedAt ? new Date(s.checkedAt).toLocaleTimeString() : '\u2014'
      ]);
    }

    console.log('\n' + table.toString());
    const healthy = services.filter((s: any) => s.status === 'healthy').length;
    const total = services.length;
    const color = healthy === total ? chalk.green : chalk.yellow;
    console.log(color(`\n${healthy}/${total} service${total !== 1 ? 's' : ''} healthy\n`));
  } catch {
    console.error(chalk.red('\u2717 Daemon not running. Try "perch start"'));
  }
}

export async function cliLogs(portOrPid: string, lines = 50) {
  try {
    const identifier = parseInt(portOrPid, 10);
    if (isNaN(identifier)) {
      console.error(chalk.red(`\u2717 Invalid port or PID: "${portOrPid}"`));
      return;
    }

    const response = await fetch(`${DAEMON_URL}/api/logs/${identifier}?lines=${lines}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      console.error(chalk.red(`\u2717 ${err.error || `No logs found for "${portOrPid}"`}`));
      return;
    }

    const data = await response.json() as any;
    const logs: any[] = data.logs || [];

    if (logs.length === 0) {
      console.log(chalk.yellow('No logs found for this process.'));
      return;
    }

    const name = data.processName || `PID ${data.pid}`;
    console.log(chalk.bold.cyan(`\nLogs for ${name}\n`));

    for (const log of logs) {
      const ts = chalk.gray(`[${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}]`);
      const levelColor = log.level === 'stderr' ? chalk.red : chalk.white;
      console.log(`${ts} ${levelColor(log.message || '')}`);
    }
    console.log();
  } catch {
    console.error(chalk.red('\u2717 Failed to fetch logs.'));
  }
}

export async function cliConfig() {
  try {
    const response = await fetch(`${DAEMON_URL}/api/config`);
    const config = await response.json() as any;

    console.log(chalk.bold.cyan('\nPerch Configuration\n'));
    console.log(JSON.stringify(config, null, 2));
    console.log();
  } catch {
    console.error(chalk.red('\u2717 Failed to fetch config. Is daemon running?'));
  }
}
