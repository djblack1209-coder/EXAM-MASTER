// Shared receipt validation for local import and authenticated operation replay.
// Layout/text are candidates, never an answer key or grading authority.
export const MATERIAL_LAYOUT_CONTRACT = 'yozi-docling-page-v1';
const string = (value, max) => typeof value === 'string' && value.length <= max;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const box = (value, width, height) =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every(Number.isFinite) &&
  0 <= value[0] &&
  value[0] <= value[2] &&
  value[2] <= width &&
  0 <= value[1] &&
  value[1] <= value[3] &&
  value[3] <= height;

export function hasMaterialLayout(material) {
  return (
    material?.recognitionEngine === 'docling' ||
    material?.extractionVersion === MATERIAL_LAYOUT_CONTRACT ||
    material?.segments?.some(
      (segment) =>
        segment?.extractionVersion === MATERIAL_LAYOUT_CONTRACT ||
        ['docling_structure', 'docling_rapidocr'].includes(segment?.method)
    )
  );
}

export function validMaterialLayoutSegment(segment, fingerprint, allowOCR) {
  if (
    !segment ||
    !hash(fingerprint) ||
    segment.sourceSha256 !== fingerprint ||
    !integer(segment.page, 1, 2048) ||
    segment.id !== `page-${segment.page}` ||
    segment.role !== 'unassigned' ||
    segment.reviewRequired !== true ||
    segment.gradingAuthority !== false ||
    segment.extractionVersion !== MATERIAL_LAYOUT_CONTRACT ||
    !string(segment.content, 20000)
  )
    return false;
  if (segment.status === 'failed')
    return (
      segment.content === '' &&
      segment.errorCode === 'PAGE_PARSE_FAILED' &&
      segment.blocks === undefined &&
      segment.words === undefined &&
      segment.preview === undefined
    );
  const { width, height } = segment.dimensions || {};
  if (
    segment.status !== undefined ||
    typeof allowOCR !== 'boolean' ||
    segment.method !== (allowOCR ? 'docling_rapidocr' : 'docling_structure') ||
    segment.location?.page !== segment.page ||
    segment.coordinateSpace !== 'pdf_points_top_left' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 14400 ||
    height > 14400 ||
    !string(segment.preview, 1400000) ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(segment.preview) ||
    !Array.isArray(segment.blocks) ||
    segment.blocks.length > 1000 ||
    !Array.isArray(segment.words) ||
    segment.words.length > 3000
  )
    return false;
  const ids = new Set(),
    contents = [],
    words = [];
  for (const block of segment.blocks) {
    if (
      !block ||
      typeof block.id !== 'string' ||
      !/^#\/(?:texts|pictures|tables)\/\d+$/.test(block.id) ||
      ids.has(block.id) ||
      !string(block.kind, 80) ||
      !block.kind ||
      block.page !== segment.page ||
      block.reviewRequired !== true ||
      !box(block.bbox, width, height) ||
      !string(block.text, 20000) ||
      !string(block.rawText, 20000)
    )
      return false;
    ids.add(block.id);
    if (block.id.startsWith('#/tables/')) {
      if (
        block.kind !== 'table' ||
        !integer(block.rows, 0, 100) ||
        !integer(block.columns, 0, 100) ||
        (block.rows === 0) !== (block.columns === 0) ||
        block.rows * block.columns > 400 ||
        !Array.isArray(block.cells) ||
        block.cells.length > 400
      )
        return false;
      const occupied = new Set(),
        grid = Array.from({ length: block.rows }, () => Array(block.columns).fill(''));
      for (const cell of block.cells) {
        if (
          !cell ||
          !integer(cell.row, 0, block.rows - 1) ||
          !integer(cell.column, 0, block.columns - 1) ||
          !integer(cell.rowSpan, 1, block.rows - cell.row) ||
          !integer(cell.columnSpan, 1, block.columns - cell.column) ||
          !string(cell.text, 4000) ||
          (cell.bbox !== null && !box(cell.bbox, width, height))
        )
          return false;
        for (let r = cell.row; r < cell.row + cell.rowSpan; r++)
          for (let c = cell.column; c < cell.column + cell.columnSpan; c++) {
            const key = r * block.columns + c;
            if (occupied.has(key)) return false;
            occupied.add(key);
          }
        grid[cell.row][cell.column] = cell.text;
        if (cell.text && cell.bbox !== null) words.push({ text: cell.text, bbox: cell.bbox });
      }
      if (occupied.size !== block.rows * block.columns) return false;
      contents.push(grid.map((row) => row.join('\t')).join('\n'));
    } else {
      if (
        block.kind === 'table' ||
        block.cells !== undefined ||
        block.rows !== undefined ||
        block.columns !== undefined
      )
        return false;
      const value = block.kind === 'formula' && block.rawText ? block.rawText : block.text || block.rawText;
      if (value) {
        contents.push(value);
        words.push({ text: value, bbox: block.bbox });
      }
    }
  }
  if (
    contents.join('\n') !== segment.content ||
    words.length !== segment.words.length ||
    segment.recognitionStatus !== (segment.content.trim() ? 'text_candidate' : 'no_text')
  )
    return false;
  return segment.words.every(
    (word, index) =>
      word &&
      word.role === 'unassigned' &&
      word.confidence === null &&
      word.text === words[index].text &&
      box(word.bbox, width, height) &&
      word.bbox.every((value, axis) => value === words[index].bbox[axis])
  );
}

export function validMaterialLayout(material) {
  return (
    !!material &&
    material.recognitionEngine === 'docling' &&
    typeof material.recognitionAllowed === 'boolean' &&
    material.extractionVersion === MATERIAL_LAYOUT_CONTRACT &&
    material.scope === 'private' &&
    material.publishable === false &&
    material.kind === 'pdf' &&
    material.gradingAuthority === false &&
    material.extraCloudCost === 0 &&
    material.dataFlow === 'authorized_local_connector' &&
    hash(material.fingerprint) &&
    material.original?.connectorFileId === material.fingerprint &&
    material.original.sha256 === material.fingerprint &&
    integer(material.original.byteLength, 1, 10485760) &&
    integer(material.totalPages, 1, 2048) &&
    (material.nextPage === null || integer(material.nextPage, 1, material.totalPages)) &&
    Array.isArray(material.segments) &&
    material.segments.length > 0 &&
    material.segments.length <= 100 &&
    new Set(material.segments.map((segment) => segment?.id)).size === material.segments.length &&
    material.segments.every(
      (segment) =>
        segment?.page <= material.totalPages &&
        validMaterialLayoutSegment(segment, material.fingerprint, material.recognitionAllowed)
    )
  );
}
