// Acceptance smoke guard: reject all common Node network entry points, including
// dependencies that do not use global fetch. Loaded before handbook dependencies.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
const blocked = () => { throw new Error('Network forbidden in offline acceptance.'); };
globalThis.fetch = blocked;
http.request = http.get = https.request = https.get = blocked;
net.connect = net.createConnection = tls.connect = blocked;
net.Socket.prototype.connect = blocked;
syncBuiltinESMExports();
