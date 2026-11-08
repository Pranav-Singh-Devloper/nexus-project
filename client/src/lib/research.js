// Research project statuses come from the server as free text; anything that
// isn't a final state means the agent is still working.
export const isProcessing = (status) => !['Completed', 'Failed', 'Demo Mode'].includes(status);
