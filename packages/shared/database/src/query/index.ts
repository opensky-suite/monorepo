/**
 * Query Helpers
 * Utilities for building SQL queries safely
 */

/**
 * Build IN clause for SQL queries
 * 
 * @example
 * ```ts
 * const { clause, params } = buildInClause('id', [1, 2, 3]);
 * // clause: "id IN ($1, $2, $3)"
 * // params: [1, 2, 3]
 * ```
 */
export function buildInClause(
  column: string,
  values: any[],
  startIndex: number = 1,
): { clause: string; params: any[] } {
  if (values.length === 0) {
    return { clause: 'FALSE', params: [] };
  }

  const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
  
  return {
    clause: `${column} IN (${placeholders})`,
    params: values,
  };
}

/**
 * Build LIKE clause for SQL queries
 * 
 * @example
 * ```ts
 * const { clause, params } = buildLikeClause('email', 'john', 'contains');
 * // clause: "email LIKE $1"
 * // params: ["%john%"]
 * ```
 */
export function buildLikeClause(
  column: string,
  value: string,
  type: 'starts' | 'ends' | 'contains' = 'contains',
  startIndex: number = 1,
): { clause: string; params: string[] } {
  let pattern: string;

  switch (type) {
    case 'starts':
      pattern = `${value}%`;
      break;
    case 'ends':
      pattern = `%${value}`;
      break;
    case 'contains':
    default:
      pattern = `%${value}%`;
      break;
  }

  return {
    clause: `${column} LIKE $${startIndex}`,
    params: [pattern],
  };
}

/**
 * Build ORDER BY clause
 * 
 * @example
 * ```ts
 * const clause = buildOrderByClause([
 *   { column: 'created_at', direction: 'DESC' },
 *   { column: 'name', direction: 'ASC' }
 * ]);
 * // "ORDER BY created_at DESC, name ASC"
 * ```
 */
export function buildOrderByClause(
  orders: Array<{ column: string; direction: 'ASC' | 'DESC' }>,
): string {
  if (orders.length === 0) {
    return '';
  }

  const clauses = orders.map(o => `${o.column} ${o.direction}`);
  return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Build LIMIT/OFFSET clause for pagination
 * 
 * @example
 * ```ts
 * const { clause, params } = buildPaginationClause(2, 20);
 * // clause: "LIMIT $1 OFFSET $2"
 * // params: [20, 20]
 * ```
 */
export function buildPaginationClause(
  page: number,
  limit: number,
  startIndex: number = 1,
): { clause: string; params: number[] } {
  const offset = (page - 1) * limit;
  
  return {
    clause: `LIMIT $${startIndex} OFFSET $${startIndex + 1}`,
    params: [limit, offset],
  };
}

/**
 * Escape SQL identifier (table name, column name)
 * Use when table/column names come from user input
 */
export function escapeIdentifier(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

/**
 * Build BETWEEN clause
 * 
 * @example
 * ```ts
 * const { clause, params } = buildBetweenClause('price', 10, 100);
 * // clause: "price BETWEEN $1 AND $2"
 * // params: [10, 100]
 * ```
 */
export function buildBetweenClause(
  column: string,
  min: any,
  max: any,
  startIndex: number = 1,
): { clause: string; params: any[] } {
  return {
    clause: `${column} BETWEEN $${startIndex} AND $${startIndex + 1}`,
    params: [min, max],
  };
}

/**
 * Build multiple WHERE conditions with AND
 */
export function buildAndConditions(
  conditions: Array<{ clause: string; params: any[] }>,
): { clause: string; params: any[] } {
  if (conditions.length === 0) {
    return { clause: '', params: [] };
  }

  const allParams: any[] = [];
  const clauses: string[] = [];

  for (const condition of conditions) {
    let adjustedClause = condition.clause;
    
    // Adjust parameter indices
    for (let i = 0; i < condition.params.length; i++) {
      const oldParam = `$${i + 1}`;
      const newParam = `$${allParams.length + 1}`;
      adjustedClause = adjustedClause.replace(oldParam, newParam);
      allParams.push(condition.params[i]);
    }

    clauses.push(`(${adjustedClause})`);
  }

  return {
    clause: clauses.join(' AND '),
    params: allParams,
  };
}

/**
 * Build multiple WHERE conditions with OR
 */
export function buildOrConditions(
  conditions: Array<{ clause: string; params: any[] }>,
): { clause: string; params: any[] } {
  if (conditions.length === 0) {
    return { clause: '', params: [] };
  }

  const allParams: any[] = [];
  const clauses: string[] = [];

  for (const condition of conditions) {
    let adjustedClause = condition.clause;
    
    // Adjust parameter indices
    for (let i = 0; i < condition.params.length; i++) {
      const oldParam = `$${i + 1}`;
      const newParam = `$${allParams.length + 1}`;
      adjustedClause = adjustedClause.replace(oldParam, newParam);
      allParams.push(condition.params[i]);
    }

    clauses.push(`(${adjustedClause})`);
  }

  return {
    clause: clauses.join(' OR '),
    params: allParams,
  };
}
