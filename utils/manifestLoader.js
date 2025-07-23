export async function loadShaderManifest() {
  const res = await fetch('../build/shader_manifest.json');
  if (!res.ok) throw new Error(`Failed to load shader manifest: ${res.status}`);
  return await res.json();
}
