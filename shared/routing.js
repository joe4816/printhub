export function validateRegistry(registry) {
  if (!registry || Number(registry.schemaVersion) !== 1) {
    throw new Error('Unsupported PrintHub routing registry.');
  }

  const endpoints = new Map((registry.endpoints || []).map(x => [String(x.id), x]));
  const media = registry.mediaProfiles || {};

  for (const route of registry.routes || []) {
    const endpoint = endpoints.get(String(route.endpointId));
    if (!endpoint) {
      throw new Error('Route ' + route.id + ' references missing endpoint ' + route.endpointId + '.');
    }

    if (!endpoint.bindings || !endpoint.bindings[route.bindingKey]) {
      throw new Error('Route ' + route.id + ' references missing binding ' + route.bindingKey + '.');
    }

    if (!media[route.mediaProfileId]) {
      throw new Error('Route ' + route.id + ' references missing media profile ' + route.mediaProfileId + '.');
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
