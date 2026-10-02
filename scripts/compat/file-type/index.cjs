// 仅适配已核实的 Jimp fromBuffer；不复制第三方解析代码、不承诺全部旧接口。
module.exports.fromBuffer = async (buffer) => {
  const { fileTypeFromBuffer } = await import('file-type-modern');
  return fileTypeFromBuffer(buffer);
};
