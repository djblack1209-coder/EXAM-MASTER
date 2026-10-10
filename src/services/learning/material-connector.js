import { assert, MATERIAL_LAYOUT_CONTRACT, validMaterialLayout } from './learning-domain.js';
import { appMaterialParseSupported, MATERIAL_PARSE_TIMEOUT } from './app-connector.js';
import { MATERIAL_LIMITS, materialFingerprint } from './material-intake.js';
import { validateLocalConnector, assertConnectorPlatform, requestConnector } from './local-connector.js';

export async function testMaterialConnector(connection, { platform, signal } = {}) {
  assertConnectorPlatform(platform);
  assert(connection, 'PRECONDITION', '请先授权资料连接器');
  validateLocalConnector(connection.endpoint, connection.allowedOrigins, connection.consent);
  assert(connection.token?.length >= 32, 'AUTH_REQUIRED', '资料连接器需要至少 32 字符令牌');
  const { ok, body: result } = await requestConnector(connection, new URL('/health', connection.endpoint), {
    platform,
    signal,
    body: '{}',
    timeout: 5000
  });
  assert(ok && result.success && result.data?.version, 'CONNECTION_FAILED', '资料连接器不可达或鉴权失败');
  const apple = result.data.ocrEngines?.appleVision;
  const docling = result.data.ocrEngines?.docling;
  const hasReadiness = apple && Object.prototype.hasOwnProperty.call(apple, 'readiness');
  const readinessValid =
    hasReadiness &&
    apple.readiness?.contract === 'wenli-apple-readiness-v1' &&
    ['preparing', 'ready', 'failed'].includes(apple.readiness.status);
  const readiness = hasReadiness
    ? { contract: 'wenli-apple-readiness-v1', status: readinessValid ? apple.readiness.status : 'failed' }
    : null;
  result.data.ocrEngines = {
    docling: {
      available:
        docling?.available === true &&
        docling.contract === MATERIAL_LAYOUT_CONTRACT &&
        docling.status === 'files_verified' &&
        docling.runtime === 'macos_connector' &&
        docling.recognitionState === 'not_tested' &&
        docling.maxPagesPerRequest === 1 &&
        docling.maxBytes === MATERIAL_LIMITS.maxBytes &&
        docling.dataFlow === 'authorized_local_connector' &&
        docling.extraCloudCost === 0 &&
        (platform !== 'app' || appMaterialParseSupported()),
      contract: MATERIAL_LAYOUT_CONTRACT,
      recognitionState: 'not_tested'
    },
    tesseract: { available: result.data.ocrBinaryAvailable === true, recognitionState: 'not_tested' },
    appleVision: {
      available:
        apple?.available === true &&
        (!hasReadiness || (readinessValid && readiness.status === 'ready')) &&
        apple.contract === 'wenli-apple-vision-v1' &&
        apple.status === 'capabilities_verified' &&
        apple.runtime === 'macos_connector' &&
        Array.isArray(apple.languages) &&
        ['zh-Hans', 'en-US'].every((language) => apple.languages.includes(language)),
      contract: 'wenli-apple-vision-v1',
      runtime: 'macos_connector',
      recognitionState: 'not_tested',
      ...(readiness ? { readiness } : {})
    }
  };
  const recovery = result.data.uploadRecovery;
  result.data.uploadRecovery = {
    available:
      recovery?.available === true &&
      recovery.contract === 'wenli-upload-v1' &&
      /^[a-f0-9]{32}$/.test(recovery.storageId),
    contract: 'wenli-upload-v1',
    ...(recovery?.storageId && /^[a-f0-9]{32}$/.test(recovery.storageId) ? { storageId: recovery.storageId } : {})
  };
  const maintenance = result.data.uploadMaintenance;
  result.data.uploadMaintenance = {
    available:
      maintenance?.available === true &&
      maintenance.contract === 'wenli-upload-maintenance-v1' &&
      /^[a-f0-9]{32}$/.test(maintenance.generation),
    contract: 'wenli-upload-maintenance-v1',
    ...(typeof maintenance?.generation === 'string' && /^[a-f0-9]{32}$/.test(maintenance.generation)
      ? { generation: maintenance.generation }
      : {})
  };
  return result.data;
}

export async function requestUploadRecovery(connection, action, upload, { platform, signal } = {}) {
  assertConnectorPlatform(platform);
  assert(connection, 'PRECONDITION', '请重新授权原资料解析器');
  validateLocalConnector(connection.endpoint, connection.allowedOrigins, connection.consent);
  assert(connection.token?.length >= 32, 'AUTH_REQUIRED', '资料连接器需要有效令牌');
  assert(
    ['prepare-upload', 'upload-receipt', 'close-upload'].includes(action) && /^[a-zA-Z0-9_-]{8,80}$/.test(upload.id),
    'INVALID_INPUT',
    '导入登记不合法'
  );
  assert(
    new URL(connection.endpoint).origin === upload.connectorOrigin &&
      connection.capabilities?.uploadRecovery?.available === true &&
      connection.capabilities.uploadRecovery.contract === 'wenli-upload-v1' &&
      /^[a-f0-9]{32}$/.test(upload.storageId) &&
      connection.capabilities.uploadRecovery.storageId === upload.storageId,
    'TARGET_MISMATCH',
    '当前解析器不是原登记存储，待办保留'
  );
  assert(!signal?.aborted, 'CANCELLED', '导入核对已取消，待办保留');
  const { ok, body: result } = await requestConnector(connection, new URL('/parse', connection.endpoint), {
    platform,
    signal,
    timeout: 10000,
    limit: 20000,
    body: JSON.stringify({
      action,
      requestId: upload.id,
      storageId: upload.storageId,
      ...(action === 'prepare-upload' ? { size: upload.size } : {})
    })
  });
  assert(!signal?.aborted, 'CANCELLED', '导入核对已取消，待办保留');
  const receipt = result.data;
  assert(
    ok &&
      result.success &&
      receipt?.contract === 'wenli-upload-v1' &&
      receipt.requestId === upload.id &&
      ['prepared', 'stored', 'receiving', 'closing', 'closed', 'absent', 'retired'].includes(receipt.state) &&
      (receipt.fileId === undefined || /^[a-f0-9]{64}$/.test(receipt.fileId)) &&
      (receipt.state !== 'stored' || /^[a-f0-9]{64}$/.test(receipt.fileId)) &&
      (receipt.state !== 'retired' ||
        (receipt.uploadBlocked === true &&
          receipt.originalStatus === 'unverified' &&
          receipt.originalDeleted === undefined)) &&
      (receipt.size === undefined ||
        receipt.size === upload.size ||
        (receipt.state === 'closed' && receipt.size === 0)),
    'RECEIPT_UNCONFIRMED',
    '未获得匹配的导入回执，待办保留'
  );
  if (action === 'prepare-upload')
    assert(
      receipt.state === 'prepared' && receipt.size === upload.size,
      'RECEIPT_UNCONFIRMED',
      '原件登记未确认，未发送正文'
    );
  if (action === 'close-upload')
    assert(
      receipt.state === 'retired' ||
        (receipt.state === 'closed' &&
          typeof receipt.originalDeleted === 'boolean' &&
          (receipt.sharedOriginalRetained === undefined || typeof receipt.sharedOriginalRetained === 'boolean')),
      'RECEIPT_UNCONFIRMED',
      '原件取消未确认，待办保留'
    );
  return receipt;
}

export async function requestUploadMaintenance(connection, preview, { platform, signal } = {}) {
  assertConnectorPlatform(platform);
  assert(connection, 'PRECONDITION', '请先重新授权原资料解析器');
  validateLocalConnector(connection.endpoint, connection.allowedOrigins, connection.consent);
  assert(connection.token?.length >= 32, 'AUTH_REQUIRED', '资料连接器需要有效令牌');
  const capabilities = connection.capabilities;
  assert(
    capabilities?.uploadRecovery?.available === true &&
      capabilities.uploadRecovery.contract === 'wenli-upload-v1' &&
      /^[a-f0-9]{32}$/.test(capabilities.uploadRecovery.storageId) &&
      capabilities.uploadMaintenance?.available === true &&
      capabilities.uploadMaintenance.contract === 'wenli-upload-maintenance-v1' &&
      /^[a-f0-9]{32}$/.test(capabilities.uploadMaintenance.generation),
    'CAPABILITY_UNAVAILABLE',
    '当前解析器未开放安全登记整理，请先检查连接'
  );
  if (preview)
    assert(
      preview.storageId === capabilities.uploadRecovery.storageId &&
        preview.generation === capabilities.uploadMaintenance.generation &&
        /^[a-f0-9]{64}$/.test(preview.previewFingerprint) &&
        /^[a-zA-Z0-9_-]{8,80}$/.test(preview.operationId),
      'CONTEXT_CHANGED',
      '维护预览已变化，请重新核对'
    );
  assert(!signal?.aborted, 'CANCELLED', '登记维护已取消');
  const { ok, body: result } = await requestConnector(connection, new URL('/parse', connection.endpoint), {
    platform,
    signal,
    timeout: 10000,
    limit: 20000,
    body: JSON.stringify({
      action: preview ? 'compact-upload-receipts' : 'preview-upload-maintenance',
      storageId: capabilities.uploadRecovery.storageId,
      ...(preview
        ? {
            requestId: preview.operationId,
            generation: preview.fromGeneration || preview.generation,
            previewFingerprint: preview.previewFingerprint
          }
        : {})
    })
  });
  assert(!signal?.aborted, 'CANCELLED', '维护回执未采用，可重新核对');
  const value = result.data;
  assert(
    ok &&
      result.success &&
      value?.contract === 'wenli-upload-maintenance-v1' &&
      value.storageId === capabilities.uploadRecovery.storageId &&
      /^[a-f0-9]{32}$/.test(value.generation) &&
      value.originalsDeleted === 0,
    'MAINTENANCE_UNCONFIRMED',
    '登记维护未取得匹配回执，未宣称完成'
  );
  if (preview) {
    assert(
      value.requestId === preview.operationId &&
        value.fromGeneration === (preview.fromGeneration || preview.generation) &&
        value.generation !== value.fromGeneration &&
        value.state === 'completed' &&
        Number.isSafeInteger(value.removedCount) &&
        value.removedCount === (preview.pending ? preview.plannedCount : preview.closedCount),
      'MAINTENANCE_UNCONFIRMED',
      '登记整理数量或批次不匹配，请重新核对'
    );
    return {
      contract: value.contract,
      storageId: value.storageId,
      requestId: value.requestId,
      fromGeneration: value.fromGeneration,
      generation: value.generation,
      state: value.state,
      removedCount: value.removedCount,
      originalsDeleted: 0
    };
  }
  assert(
    /^[a-f0-9]{64}$/.test(value.previewFingerprint) &&
      typeof value.pending === 'boolean' &&
      Number.isSafeInteger(value.maxReceipts) &&
      value.maxReceipts > 0 &&
      value.maxReceipts <= 512 &&
      ['closedCount', 'openCount'].every((k) => Number.isSafeInteger(value[k]) && value[k] >= 0) &&
      value.closedCount + value.openCount <= value.maxReceipts &&
      (!value.pending ||
        (/^[a-zA-Z0-9_-]{8,80}$/.test(value.requestId) &&
          /^[a-f0-9]{32}$/.test(value.fromGeneration) &&
          value.fromGeneration !== value.generation &&
          Number.isSafeInteger(value.plannedCount) &&
          value.plannedCount > 0 &&
          value.plannedCount <= 512)),
    'MAINTENANCE_UNCONFIRMED',
    '维护预览结构不合法，未开始整理'
  );
  return {
    contract: value.contract,
    storageId: value.storageId,
    generation: value.generation,
    previewFingerprint: value.previewFingerprint,
    closedCount: value.closedCount,
    openCount: value.openCount,
    maxReceipts: value.maxReceipts,
    originalsDeleted: 0,
    pending: value.pending,
    ...(value.pending
      ? { requestId: value.requestId, fromGeneration: value.fromGeneration, plannedCount: value.plannedCount }
      : {})
  };
}

export async function parseConnectedMaterial(connection, input, options = {}) {
  assertConnectorPlatform(options.platform);
  assert(connection, 'PRECONDITION', '请先授权资料连接器');
  validateLocalConnector(connection.endpoint, connection.allowedOrigins, connection.consent);
  assert(connection.token?.length >= 32, 'AUTH_REQUIRED', '资料连接器需要至少 32 字符令牌');
  assert(input.size <= MATERIAL_LIMITS.maxBytes, 'FILE_LIMIT', '单份资料最多 10 MB');
  const recognitionEngine = input.recognitionEngine || 'tesseract';
  assert(
    ['tesseract', 'apple-vision', 'docling'].includes(recognitionEngine),
    'ENGINE_UNSUPPORTED',
    '资料识别引擎不受支持'
  );
  const layout = recognitionEngine === 'docling';
  if (layout) {
    assert(typeof input.allowRecognition === 'boolean', 'CONSENT_REQUIRED', '请明确选择是否识别图片文字');
    assert(
      connection.capabilities?.docling?.available === true &&
        connection.capabilities.docling.contract === MATERIAL_LAYOUT_CONTRACT,
      'ENGINE_UNAVAILABLE',
      '请先检查版面整理连接，未发送资料'
    );
    assert(
      options.platform !== 'app' || appMaterialParseSupported(),
      'PLATFORM_UNSUPPORTED',
      '此App尚不支持逐页版面处理，未发送资料'
    );
    const recovery = connection.capabilities?.uploadRecovery;
    assert(
      recovery?.available === true &&
        recovery.contract === 'wenli-upload-v1' &&
        /^[a-f0-9]{32}$/.test(recovery.storageId),
      'ENGINE_UNAVAILABLE',
      '版面整理需要可恢复的原件存储，请重新检查连接'
    );
    assert(
      !input.fileId || input.storageId === recovery.storageId,
      'TARGET_MISMATCH',
      '当前解析器不是保存这份原件的存储，未发送续页请求'
    );
    assert(
      input.fileId
        ? /^[a-f0-9]{64}$/.test(input.fileId)
        : typeof input.contentBase64 === 'string' && /^JVBERi0/.test(input.contentBase64),
      'FILE_TYPE_UNSUPPORTED',
      '版面整理只支持PDF，请选择PDF或切换解析方式'
    );
    assert(
      Number.isSafeInteger(input.startPage || 1) && (input.startPage || 1) <= 2048 && (input.startPage || 1) > 0,
      'INVALID_INPUT',
      '资料页码不合法'
    );
  }
  if (recognitionEngine === 'apple-vision') {
    assert(input.allowRecognition === true, 'CONSENT_REQUIRED', 'Apple Vision 需要本次明确允许文字识别');
    assert(
      connection.capabilities?.appleVision?.available === true &&
        connection.capabilities.appleVision.contract === 'wenli-apple-vision-v1',
      'ENGINE_UNAVAILABLE',
      '请先验证当前解析器 Mac 的 Apple Vision 能力，未发送资料'
    );
  }
  const endpoint = new URL('/parse', connection.endpoint);
  let page = input.startPage || 1;
  let fileId = input.fileId;
  let contentBase64 = input.contentBase64;
  const results = [];
  let upload = null;
  if (!fileId && connection.capabilities?.uploadRecovery?.available === true) {
    assert(typeof options.onUploadIntent === 'function', 'PRECONDITION', '请先保存无正文导入登记');
    upload = {
      id: options.uploadId,
      connectorOrigin: endpoint.origin,
      storageId: connection.capabilities.uploadRecovery.storageId,
      size: input.size,
      recognitionAllowed: input.allowRecognition === true,
      recognitionEngine
    };
    await options.onUploadIntent(upload);
    await requestUploadRecovery(connection, 'prepare-upload', upload, options);
  }
  do {
    options.assertCurrent?.();
    assert(!options.signal?.aborted, 'CANCELLED', '资料解析已取消，已保存的片段可以继续使用');
    const body = JSON.stringify({
      name: input.name,
      ...(fileId ? { fileId } : { contentBase64 }),
      ...(layout ? { storageId: connection.capabilities.uploadRecovery.storageId } : {}),
      ...(upload && !fileId
        ? { requestId: upload.id, storageId: upload.storageId }
        : input.storageId
          ? { storageId: input.storageId }
          : {}),
      startPage: page,
      allowOCR: input.allowRecognition === true,
      ...(recognitionEngine !== 'tesseract' ? { ocrEngine: recognitionEngine } : {})
    });
    assert(body.length <= 15 * 1024 * 1024, 'FILE_LIMIT', '资料传输超过本机资源上限');
    const { ok, body: result } = await requestConnector(connection, endpoint, {
      platform: options.platform,
      signal: options.signal,
      body,
      timeout: layout ? MATERIAL_PARSE_TIMEOUT : 35000,
      limit: 2000000
    });
    assert(ok, 'PARSE_FAILED', '资料解析失败，可重试此页或先粘贴可靠文本');
    assert(!options.signal?.aborted, 'CANCELLED', '资料解析已取消，已保存的片段可以继续使用');
    assert(result.success && result.data?.segments, 'PARSE_FAILED', '解析结果结构不合法');
    const material = result.data;
    assert(
      material.scope === 'private' && Array.isArray(material.segments) && material.segments.length <= 5,
      'INVALID_RESPONSE',
      '解析范围不合法'
    );
    if (layout)
      assert(
        validMaterialLayout(material) &&
          material.segments.length === 1 &&
          material.segments[0].page === page &&
          material.recognitionAllowed === input.allowRecognition &&
          (!fileId || material.fingerprint === fileId) &&
          (fileId || material.original.byteLength === input.size) &&
          (!results.length || material.totalPages === results[0].totalPages) &&
          material.nextPage === (page < material.totalPages ? page + 1 : null),
        'INVALID_RESPONSE',
        '版面结果与本次原件、页码或待核对状态不符，未保存此页'
      );
    if (recognitionEngine === 'apple-vision')
      assert(
        material.recognitionEngine === recognitionEngine &&
          material.segments.every(
            (segment) =>
              segment.status === 'failed' ||
              segment.method === 'apple_vision' ||
              (material.kind === 'pdf' && segment.method === 'pdf_text')
          ),
        'INVALID_RESPONSE',
        '解析器未按本次 Apple Vision 选择返回结果，未保存资料'
      );
    material.recognitionAllowed = input.allowRecognition === true;
    material.recognitionEngine = recognitionEngine;
    if (material.original?.connectorFileId) {
      material.original.connectorOrigin = endpoint.origin;
      if (layout) material.original.storageId = connection.capabilities.uploadRecovery.storageId;
      // 指纹只命名资料；鉴权和实际删除目标仍逐项核对，不能凭指纹授权。
      material.id = `${material.original.connectorFileId}:${materialFingerprint(endpoint.origin)}${layout ? ':' + material.original.storageId : ''}`;
    }
    results.push(material);
    await options.onBatch?.(material);
    if (upload) {
      await options.onUploadSaved?.(upload.id);
      upload = null;
    }
    options.onProgress?.({
      completed: layout ? page : Math.min(page + 4, material.totalPages),
      total: material.totalPages
    });
    fileId = material.original?.connectorFileId || material.id;
    contentBase64 = null;
    page = material.nextPage;
    // 每个动作最多四个请求：普通提取20页，版面整理4页。
    if (results.length >= 4) break;
  } while (page);
  return { results, nextPage: page, fileId, pagesPerAction: layout ? 4 : 20 };
}

export async function deleteConnectedMaterial(connection, original, { platform, signal } = {}) {
  assertConnectorPlatform(platform);
  assert(connection, 'PRECONDITION', '请连接保存原件的资料解析器后重试');
  validateLocalConnector(connection.endpoint, connection.allowedOrigins, connection.consent);
  assert(connection.token?.length >= 32, 'AUTH_REQUIRED', '资料连接器需要至少 32 字符令牌');
  assert(
    /^[a-f0-9]{64}$/.test(original?.fileId) && new URL(connection.endpoint).origin === original.connectorOrigin,
    'TARGET_MISMATCH',
    '当前连接器不是导入原件的目标，未发送删除请求'
  );
  assert(!signal?.aborted, 'CANCELLED', '原件删除已取消，待办保留');
  const { ok, body: result } = await requestConnector(connection, new URL('/delete', connection.endpoint), {
    platform,
    signal,
    body: JSON.stringify({ fileId: original.fileId }),
    timeout: 10000,
    limit: 20000
  });
  assert(
    ok && result.success && result.data?.deleted === true && result.data.fileId === original.fileId,
    'DELETE_UNCONFIRMED',
    '原件删除未获得有效回执，待办保留，可重试'
  );
  assert(!signal?.aborted, 'CANCELLED', '删除回执未保存，可再次查询删除结果');
  return result.data;
}

export async function chooseWeixinMaterialFile(assertCurrent = () => undefined) {
  assertConnectorPlatform('weixin');
  assert(typeof wx.chooseMessageFile === 'function', 'PLATFORM_UNSUPPORTED', '此微信端缺少文件选择能力');
  assert(
    typeof wx.requirePrivacyAuthorize === 'function',
    'PLATFORM_UNSUPPORTED',
    '此微信端缺少隐私授权接口，未选择或读取文件'
  );
  assertCurrent();
  await new Promise((resolve, reject) =>
    wx.requirePrivacyAuthorize({
      success: resolve,
      fail: () => reject(Object.assign(new Error('未获微信隐私授权，未选择或读取文件'), { code: 'CONSENT_REQUIRED' }))
    })
  );
  assertCurrent();
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'png', 'jpg', 'jpeg'],
      success(result) {
        try {
          assertCurrent();
          const file = result.tempFiles?.[0];
          assert(
            file && typeof file.path === 'string' && /\.(?:pdf|png|jpe?g)$/i.test(file.name || ''),
            'FILE_TYPE',
            '请选择PDF或PNG/JPEG图片'
          );
          assert(
            Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MATERIAL_LIMITS.maxBytes,
            'FILE_LIMIT',
            '文件超过10 MB或大小不合法，请先分段'
          );
          resolve({ name: file.name, size: file.size, path: file.path });
        } catch (error) {
          reject(error);
        }
      },
      fail() {
        reject(Object.assign(new Error('文件选择已取消或未获隐私授权，未读取或发送资料'), { code: 'CANCELLED' }));
      }
    });
  });
}

// 仅在逐次发送许可后读取；以SDK length限制真实读取字节，不把文件路径写入学习事实。
export async function readWeixinMaterialFile(file, { consent, assertCurrent = () => undefined } = {}) {
  assert(consent === true, 'CONSENT_REQUIRED', '请先明确允许将本次文件交给已授权解析器；未读取文件');
  assertConnectorPlatform('weixin');
  assertCurrent();
  assert(
    file && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MATERIAL_LIMITS.maxBytes,
    'FILE_LIMIT',
    '文件超过10 MB或大小不合法'
  );
  const fs = wx.getFileSystemManager?.();
  assert(
    typeof fs?.readFile === 'function' && typeof fs.stat === 'function',
    'PLATFORM_UNSUPPORTED',
    '此微信端缺少受支持的文件大小核对或读取接口'
  );
  const inspect = () =>
    new Promise((resolve, reject) =>
      fs.stat({
        path: file.path,
        success(result) {
          try {
            assertCurrent();
            assert(
              result.stats?.size === file.size && result.stats.isFile?.() === true,
              'FILE_CHANGED',
              '文件大小或类型已变化，请重新选择'
            );
            resolve(result.stats);
          } catch (error) {
            reject(error);
          }
        },
        fail() {
          reject(Object.assign(new Error('文件信息读取失败，未发送资料'), { code: 'FILE_READ_FAILED' }));
        }
      })
    );
  const before = await inspect();
  assertCurrent();
  const data = await new Promise((resolve, reject) => {
    fs.readFile({
      filePath: file.path,
      encoding: 'base64',
      position: 0,
      length: file.size,
      success(result) {
        try {
          assertCurrent();
          assert(
            typeof result.data === 'string' &&
              result.data.length === 4 * Math.ceil(file.size / 3) &&
              /^[A-Za-z0-9+/]+={0,2}$/.test(result.data) &&
              (result.data.match(/=+$/)?.[0].length || 0) === (3 - (file.size % 3)) % 3,
            'FILE_CHANGED',
            '文件读取大小或编码与选择结果不同，请重新选择'
          );
          resolve(result.data);
        } catch (error) {
          reject(error);
        }
      },
      fail() {
        reject(Object.assign(new Error('文件读取失败，未发送资料'), { code: 'FILE_READ_FAILED' }));
      }
    });
  });
  const after = await inspect();
  assert(after.lastModifiedTime === before.lastModifiedTime, 'FILE_CHANGED', '文件读取期间发生变化，请重新选择');
  return { name: file.name, size: file.size, contentBase64: data };
}
