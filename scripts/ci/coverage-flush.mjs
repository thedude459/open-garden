// Preloaded with `node --import` when the API runs under NODE_V8_COVERAGE in
// e2e. Node writes V8 coverage only on a normal exit, and a process killed by
// SIGTERM/SIGINT does not exit normally — so exit cleanly on those signals.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => process.exit(0));
}
