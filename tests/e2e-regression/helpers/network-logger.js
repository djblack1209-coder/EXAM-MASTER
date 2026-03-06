import fs from 'node:fs/promises';

const MAX_ENTRIES = 400;

export class NetworkLogger {
  constructor(page, testInfo) {
    this.page = page;
    this.testInfo = testInfo;
    this.entries = [];
    this._onRequest = this._onRequest.bind(this);
    this._onResponse = this._onResponse.bind(this);
    this._onRequestFailed = this._onRequestFailed.bind(this);
    this.startedAt = Date.now();
  }

  start() {
    this.page.on('request', this._onRequest);
    this.page.on('response', this._onResponse);
    this.page.on('requestfailed', this._onRequestFailed);
  }

  stop() {
    this.page.off('request', this._onRequest);
    this.page.off('response', this._onResponse);
    this.page.off('requestfailed', this._onRequestFailed);
  }

  _push(entry) {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
  }

  _onRequest(request) {
    this._push({
      type: 'request',
      ts: Date.now(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType()
    });
  }

  _onResponse(response) {
    this._push({
      type: 'response',
      ts: Date.now(),
      status: response.status(),
      url: response.url()
    });
  }

  _onRequestFailed(request) {
    this._push({
      type: 'requestfailed',
      ts: Date.now(),
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText || 'UNKNOWN'
    });
  }

  async flush() {
    const payload = {
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      test: this.testInfo.titlePath,
      entries: this.entries
    };

    const filePath = this.testInfo.outputPath('network-log.json');
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    await this.testInfo.attach('network-log', {
      path: filePath,
      contentType: 'application/json'
    });
    return filePath;
  }
}
