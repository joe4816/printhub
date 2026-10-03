export function validateRegistry(registry) {
  if (!registry || Number(registry.schemaVersion) !== 1) {
    throw new Error('Unsupported PrintHub routing registry.');
  }

  if (!registry.mediaProfiles || typeof registry.mediaProfiles !== 'object') {
    throw new Error('Routing registry is missing mediaProfiles.');
  }

  if (!Array.isArray(registry.endpoints) || !registry.endpoints.length) {
    throw new Error('Routing registry must define at least one endpoint.');
  }

  if (!Array.isArray(registry.routes) || !registry.routes.length) {
    throw new Error('Routing registry must define at least one route.');
  }

  for (const [mediaId, media] of Object.entries(registry.mediaProfiles)) {
    requireId(mediaId, 'media profile ID');
    if (!media || typeof media !== 'object') {
      throw new Error('Media profile ' + mediaId + ' must be an object.');
    }
  }

  assertUnique(registry.endpoints, 'endpoint');
  assertUnique(registry.routes, 'route');

  const endpoints = new Map();

  for (const endpoint of registry.endpoints) {
    const id = requireId(endpoint && endpoint.id, 'endpoint ID');

    if (!String(endpoint.type || '').trim()) {
      throw new Error('Endpoint ' + id + ' is missing type.');
    }

    if (!endpoint.bindings || typeof endpoint.bindings !== 'object') {
      throw new Error('Endpoint ' + id + ' is missing bindings.');
    }

    const bindingKeys = Object.keys(endpoint.bindings);
    if (!bindingKeys.length) {
      throw new Error('Endpoint ' + id + ' must define at least one binding.');
    }

    for (const bindingKey of bindingKeys) {
      requireId(bindingKey, 'binding key');
      const binding = endpoint.bindings[bindingKey];
      if (!binding || typeof binding !== 'object') {
        throw new Error('Binding ' + bindingKey + ' on endpoint ' + id + ' must be an object.');
      }
      if (!String(binding.mode || '').trim()) {
        throw new Error('Binding ' + bindingKey + ' on endpoint ' + id + ' is missing mode.');
      }
    }

    endpoints.set(id, endpoint);
  }

  for (const route of registry.routes) {
    const routeId = requireId(route && route.id, 'route ID');
    const endpointId = requireId(route.endpointId, 'route endpoint ID');
    const bindingKey = requireId(route.bindingKey, 'route binding key');
    const mediaProfileId = requireId(route.mediaProfileId, 'route media profile ID');
    requireId(route.rendererId, 'route renderer ID');

    const endpoint = endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error('Route ' + routeId + ' references missing endpoint ' + endpointId + '.');
    }

    if (!endpoint.bindings[bindingKey]) {
      throw new Error('Route ' + routeId + ' references missing binding ' + bindingKey + '.');
    }

    if (!registry.mediaProfiles[mediaProfileId]) {
      throw new Error('Route ' + routeId + ' references missing media profile ' + mediaProfileId + '.');
    }
  }

  return true;
}

export function expandPrintSelection(input, registry) {
  validateRegistry(registry);

  const transactionId = String(input && input.transactionId || '').trim();
  const sourceApp = String(input && input.sourceApp || '').trim();
  const primaryRouteId = String(input && input.primaryRouteId || '').trim();
  const secondaryRouteId = String(input && input.secondaryRouteId || '').trim();

  if (!transactionId) throw new Error('transactionId is required.');
  if (!sourceApp) throw new Error('sourceApp is required.');
  if (!primaryRouteId) throw new Error('primaryRouteId is required.');
  if (secondaryRouteId && secondaryRouteId === primaryRouteId) {
    throw new Error('Primary and secondary routes must be different.');
  }

  const selected = [
    {routeId: primaryRouteId, copyRole: 'PRIMARY'},
    ...(secondaryRouteId ? [{routeId: secondaryRouteId, copyRole: 'SECONDARY'}] : [])
  ];

  const routeMap = new Map((registry.routes || []).map(x => [String(x.id), x]));
  const endpointMap = new Map((registry.endpoints || []).map(x => [String(x.id), x]));
  const jobGroupId = 'JG-' + transactionId;

  return selected.map((selection, index) => {
    const route = routeMap.get(selection.routeId);
    if (!route) throw new Error('Unknown print route: ' + selection.routeId + '.');

    const endpoint = endpointMap.get(String(route.endpointId));
    const ordinal = String(index + 1).padStart(2, '0');

    return {
      schemaVersion: 1,
      printJobId: 'PJ-' + transactionId + '-' + ordinal,
      jobGroupId,
      sourceApp,
      sourceTransactionId: transactionId,
      copyRole: selection.copyRole,
      routeId: route.id,
      routeLabel: route.label || route.id,
      endpointId: endpoint.id,
      endpointType: endpoint.type,
      queueId: endpoint.queueId || endpoint.id,
      bindingKey: route.bindingKey,
      mediaProfileId: route.mediaProfileId,
      rendererId: route.rendererId,
      status: 'QUEUED'
    };
  });
}

function assertUnique(items, kind) {
  const seen = new Set();

  for (const item of items) {
    const id = requireId(item && item.id, kind + ' ID');
    if (seen.has(id)) {
      throw new Error('Duplicate ' + kind + ' ID: ' + id + '.');
    }
    seen.add(id);
  }
}

function requireId(value, label) {
  const id = String(value || '').trim();
  if (!id) throw new Error('Missing ' + label + '.');
  return id;
}
