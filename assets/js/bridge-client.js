(function () {
  'use strict';

  const bridgeNonce = window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const CHANNEL = `habit-tracker-bridge-v1:${bridgeNonce}`;
  const config = window.HABIT_TRACKER_CONFIG || {};
  const iframe = document.getElementById('gasBridge');
  const pending = new Map();
  let bridgeOrigin = '';
  let bridgeWindow = null;
  let readyResolve;
  let readyReject;
  let readySettled = false;

  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function isTrustedBridgeOrigin(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === 'https:' && (
        url.hostname === 'script.google.com' ||
        url.hostname.endsWith('.googleusercontent.com')
      );
    } catch (error) {
      return false;
    }
  }

  function settleReady(error) {
    if (readySettled) return;
    readySettled = true;
    if (error) readyReject(error);
    else readyResolve();
  }

  window.addEventListener('message', event => {
    if (!isTrustedBridgeOrigin(event.origin)) return;
    const message = event.data || {};
    if (message.channel !== CHANNEL) return;

    if (message.type === 'ready') {
      bridgeWindow = event.source;
      bridgeOrigin = event.origin;
      settleReady();
      return;
    }

    if (event.source !== bridgeWindow || message.type !== 'response' || !message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(message.error || 'Permintaan ke server gagal.'));
  });

  async function call(method, args) {
    await ready;
    return new Promise((resolve, reject) => {
      const id = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeout = Number(config.requestTimeoutMs) || 70000;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Server terlalu lama merespons. Periksa koneksi internet lalu coba lagi.'));
      }, method === 'exportPdf' ? Math.max(timeout, 120000) : timeout);

      pending.set(id, { resolve, reject, timer });
      bridgeWindow.postMessage({
        channel: CHANNEL,
        type: 'request',
        id,
        method,
        args: Array.isArray(args) ? args : []
      }, bridgeOrigin);
    });
  }

  window.habitApi = Object.freeze({ call, ready });

  if (!config.bridgeUrl) {
    settleReady(new Error('Alamat API belum dikonfigurasi.'));
    return;
  }

  const startupTimer = setTimeout(() => {
    settleReady(new Error('Tidak dapat terhubung ke database. Muat ulang halaman atau periksa koneksi internet.'));
  }, 25000);
  ready.finally(() => clearTimeout(startupTimer));
  const bridgeUrl = new URL(config.bridgeUrl);
  bridgeUrl.searchParams.set('nonce', bridgeNonce);
  iframe.src = bridgeUrl.toString();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}());
