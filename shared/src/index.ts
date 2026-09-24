/**
 * @orbit/shared — contract-first package (BUILD_PROMPT rule 4).
 * Everything the API and the web client must agree on lives here:
 * error codes, RBAC matrix, constants, envelopes, pagination, ordering.
 */
export * from './errorCodes.js';
export * from './permissions.js';
export * from './constants.js';
export * from './envelope.js';
export * from './pagination.js';
export * from './fractionalIndex.js';
