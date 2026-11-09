const NODE_PORTS = Object.freeze({ A: 3101, B: 3102, C: 3103, D: 3104, E: 3105 });

export async function localNodeRequest(nodeId, path, options = {}) {
  const port = NODE_PORTS[nodeId];
  if (!port) throw new Error('Unknown embedded node: ' + nodeId);
  const token = sessionStorage.getItem('st-embedded-local-token');
  if (!token) throw new Error('Embedded local backend has not started in this app session.');
  const response = await fetch('http://127.0.0.1:' + port + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      'X-Local-Token': token,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || ('Local node request failed: ' + response.status));
  return result;
}

export const getEmbeddedNodeHealth = (nodeId) => localNodeRequest(nodeId, '/health');
export const getEmbeddedNodeTasks = (nodeId) => localNodeRequest(nodeId, '/tasks');
export const dispatchEmbeddedTask = (taskType, payload = {}) =>
  localNodeRequest('E', '/dispatch', { method: 'POST', body: JSON.stringify({ taskType, payload }) });
export const saveLocalSection = (id, sectionName, content) =>
  localNodeRequest('A', '/sections', { method: 'POST', body: JSON.stringify({ id, sectionName, content }) });
export const getLocalSections = () => localNodeRequest('A', '/sections');
