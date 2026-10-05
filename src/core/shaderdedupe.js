// One shader per program instead of one per object.
// three.js names the uniform buffer of every clipping context (the section cut) and of every small instance array
// after the node's unique id. The shader text then differs from object to object although the program is the same,
// and three's program cache (keyed by that text) compiled ~440 copies on the first frame: the page froze for ~2 s
// on a fast Mac, ~9 s on a 4× slower CPU and ~24 s on the WebGL 2 fallback.
// Renaming those buffers by their order of appearance makes equal shaders equal text, so each compiles once.
// WebGPU binds them by index, so only the text changes; WebGL binds uniform blocks by name, so the bindings follow.
import { WGSLNodeBuilder, GLSLNodeBuilder } from 'three/webgpu';

function canonicalise(builder, pattern, rename) {
  const ids = new Map();
  const index = (id) => {
    if (!ids.has(id)) ids.set(id, ids.size);
    return ids.get(id);
  };
  // vertex first, so a buffer used in both stages gets one name
  for (const key of ['vertexShader', 'fragmentShader', 'computeShader']) {
    if (typeof builder[key] === 'string') builder[key] = builder[key].replace(pattern, (m, prefix, id) => rename(prefix, index(id)));
  }
  return ids;
}

const wgslBuildCode = WGSLNodeBuilder.prototype.buildCode;
WGSLNodeBuilder.prototype.buildCode = function () {
  wgslBuildCode.call(this);
  canonicalise(this, /\b(NodeBuffer_)(\d+)/g, (prefix, i) => `NodeBufferC${i}`);
};

const glslBuildCode = GLSLNodeBuilder.prototype.buildCode;
GLSLNodeBuilder.prototype.buildCode = function () {
  glslBuildCode.call(this);
  // block NodeBuffer_<id> { … buffer<id>[n] }
  const ids = canonicalise(this, /\b(NodeBuffer_|buffer)(\d+)\b/g, (prefix, i) => (prefix === 'buffer' ? `bufferC${i}` : `NodeBufferC${i}`));
  for (const stage of Object.values(this.bindings)) {
    for (const group of Object.values(stage)) {
      for (const binding of group) {
        const m = binding.isUniformBuffer && /^NodeBuffer_(\d+)$/.exec(binding.name);
        if (m && ids.has(m[1])) binding.name = `NodeBufferC${ids.get(m[1])}`;
      }
    }
  }
};
